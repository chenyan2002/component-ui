use crate::names::LocalNames;
use crate::source::Source;
use anyhow::Result;
use heck::{ToLowerCamelCase, ToUpperCamelCase};
use std::collections::BTreeMap;
use wit_component::DecodedWasm;
use wit_parser::{
    Function, FunctionKind, Handle, InterfaceId, Resolve, Type, TypeDefKind, TypeOwner,
    WorldItem, WorldKey,
};

struct Bindgen<'a> {
    src: Source,
    resolve: &'a Resolve,
    defs: Vec<String>,
    export_interfaces: Vec<String>,
    import_interfaces: Vec<String>,
    resources: BTreeMap<String, Bindgen<'a>>,
    local_names: LocalNames,
}
impl<'a> Bindgen<'a> {
    fn new(resolve: &'a Resolve) -> Bindgen<'a> {
        Self {
            src: Source::default(),
            resolve,
            defs: Vec::new(),
            export_interfaces: Vec::new(),
            import_interfaces: Vec::new(),
            resources: Default::default(),
            local_names: LocalNames::default(),
        }
    }
    fn fork(&self) -> Bindgen<'a> {
        let mut res = Self::new(self.resolve);
        res.local_names = self.local_names.clone();
        res
    }
    fn pp_optional_ty(&mut self, ty: Option<&Type>) {
        match ty {
            Some(ty) => self.pp_ty(ty),
            None => self.src.push_str("IDL.Null"),
        }
    }
    fn pp_ty_kind(&mut self, kind: &TypeDefKind, parent_id: Option<InterfaceId>) {
        match kind {
            TypeDefKind::Type(t) => {
                // A type `use`d from another interface is referenced by that interface's own
                // name for it, which may itself be a renamed `use`, e.g. `pollable as body`.
                let foreign = match t {
                    Type::Id(target) => {
                        let target = &self.resolve.types[*target];
                        match (target.owner, &target.name) {
                            (TypeOwner::Interface(i), Some(name)) if parent_id != Some(i) => {
                                Some((self.resolve.id_of(i).unwrap(), name.to_upper_camel_case()))
                            }
                            _ => None,
                        }
                    }
                    _ => None,
                };
                match foreign {
                    Some((owned_interface_id, name)) => {
                        let owned_iface_name = interface_type_name(&owned_interface_id);
                        let owned_iface_name = self
                            .local_names
                            .get_or_create(&owned_interface_id, &owned_iface_name)
                            .0
                            .to_string();
                        self.src.push_str(&format!("{owned_iface_name}.{name}"));
                    }
                    None => self.pp_ty(t),
                }
            }
            TypeDefKind::List(t) => {
                self.src.push_str("IDL.Vec(");
                self.pp_ty(t);
                self.src.push_str(")");
            }
            TypeDefKind::Option(t) => {
                self.src.push_str("IDL.Opt(");
                self.pp_ty(t);
                self.src.push_str(")");
            }
            TypeDefKind::Tuple(ts) => {
                self.src.push_str("IDL.Tuple([");
                for (i, ty) in ts.types.iter().enumerate() {
                    if i > 0 {
                        self.src.push_str(", ");
                    }
                    self.pp_ty(ty);
                }
                self.src.push_str("])");
            }
            TypeDefKind::Result(r) => {
                self.src.push_str("IDL.Result(");
                self.pp_optional_ty(r.ok.as_ref());
                self.src.push_str(", ");
                self.pp_optional_ty(r.err.as_ref());
                self.src.push_str(")");
            }
            TypeDefKind::Record(r) => {
                self.src.push_str("IDL.Record({ ");
                for f in r.fields.iter() {
                    self.src.push_str(&format!("'{}': ", f.name));
                    self.pp_ty(&f.ty);
                    self.src.push_str(", ");
                }
                self.src.push_str(" })");
            }
            TypeDefKind::Variant(v) => {
                self.src.push_str("IDL.Variant({ ");
                for f in v.cases.iter() {
                    self.src.push_str(&format!("'{}': ", f.name));
                    self.pp_optional_ty(f.ty.as_ref());
                    self.src.push_str(", ");
                }
                self.src.push_str(" })");
            }
            TypeDefKind::Enum(enum_) => {
                self.src.push_str("IDL.Enum([");
                self.src.push_str(
                    &enum_
                        .cases
                        .iter()
                        .map(|e| format!("'{}'", e.name))
                        .collect::<Vec<_>>()
                        .join(", "),
                );
                self.src.push_str("])");
            }
            TypeDefKind::Flags(f) => {
                self.src.push_str("IDL.Flags([");
                self.src.push_str(
                    &f.flags
                        .iter()
                        .map(|f| format!("'{}'", f.name))
                        .collect::<Vec<_>>()
                        .join(", "),
                );
                self.src.push_str("])");
            }
            TypeDefKind::Handle(h) => {
                let ty = match h {
                    Handle::Own(r) => {
                        self.src.push_str("IDL.Owned(");
                        r
                    }
                    Handle::Borrow(r) => {
                        self.src.push_str("IDL.Borrow(");
                        r
                    }
                };
                let ty = &self.resolve.types[*ty];
                let Some(name) = &ty.name else {
                    panic!("anonymous resource handle")
                };
                self.src.push_str(&name.to_upper_camel_case());
                self.src.push_str(")");
            }
            TypeDefKind::Future(_)
            | TypeDefKind::Stream(_)
            | TypeDefKind::Map(..)
            | TypeDefKind::FixedLengthList(..) => todo!(),
            TypeDefKind::Resource => unreachable!(),
            TypeDefKind::Unknown => unreachable!(),
        }
    }
    fn pp_ty(&mut self, ty: &Type) {
        match ty {
            Type::Bool => self.src.push_str("IDL.Bool"),
            Type::U8 => self.src.push_str("IDL.U8"),
            Type::U16 => self.src.push_str("IDL.U16"),
            Type::U32 => self.src.push_str("IDL.U32"),
            Type::U64 => self.src.push_str("IDL.U64"),
            Type::S8 => self.src.push_str("IDL.S8"),
            Type::S16 => self.src.push_str("IDL.S16"),
            Type::S32 => self.src.push_str("IDL.S32"),
            Type::S64 => self.src.push_str("IDL.S64"),
            Type::F32 => self.src.push_str("IDL.F32"),
            Type::F64 => self.src.push_str("IDL.F64"),
            Type::Char => self.src.push_str("IDL.Char"),
            Type::String => self.src.push_str("IDL.String"),
            Type::ErrorContext => self.src.push_str("IDL.S32"),
            Type::Id(id) => {
                let ty = &self.resolve.types[*id];
                if let Some(name) = &ty.name {
                    return self.src.push_str(&name.to_upper_camel_case());
                }
                self.pp_ty_kind(&ty.kind, None);
            }
        }
    }
    fn type_defs(&mut self, iface_id: InterfaceId) {
        let iface = &self.resolve.interfaces[iface_id];
        for (name, id) in &iface.types {
            let ty = &self.resolve.types[*id];
            match &ty.kind {
                TypeDefKind::Resource => {
                    let resource = ty.name.clone().unwrap().to_upper_camel_case();
                    self.resources
                        .entry(resource)
                        .or_insert_with(|| Bindgen::new(self.resolve));
                }
                kind => {
                    let ident = name.to_upper_camel_case();
                    self.src.push_str(&format!("const {ident} = "));
                    // The type keeps its WIT name to show. An alias refers to its target, which
                    // keeps its own.
                    let named = !matches!(kind, TypeDefKind::Type(_));
                    if named {
                        self.src.push_str(&format!("IDL.Named('{name}', "));
                    }
                    self.pp_ty_kind(kind, Some(iface_id));
                    if named {
                        self.src.push_str(")");
                    }
                    self.src.push_str(";\n");
                    self.defs.push(ident);
                }
            }
        }
    }
    fn func(&mut self, func: &Function) {
        let iface = if let Some(ty) = func.kind.resource() {
            let ty = &self.resolve.types[ty];
            let resource = ty.name.clone().unwrap().to_upper_camel_case();
            self.resources
                .entry(resource)
                .or_insert_with(|| Bindgen::new(self.resolve))
        } else {
            self
        };
        let out_name = func.item_name().to_lower_camel_case();
        iface.src.push_str(&format!("'{out_name}': IDL.Func(["));
        let param_start = match &func.kind {
            FunctionKind::Method(_) | FunctionKind::AsyncMethod(_) => 1,
            _ => 0,
        };
        for (i, param) in func.params[param_start..].iter().enumerate() {
            if i > 0 {
                iface.src.push_str(", ");
            }
            iface.src.push_str(&format!("['{}', ", param.name));
            iface.pp_ty(&param.ty);
            iface.src.push_str("]");
        }
        iface.src.push_str("], [");
        if let Some(ty) = func.result {
            if !matches!(func.kind, FunctionKind::Constructor(_)) {
                iface.pp_ty(&ty);
            }
        }
        iface.src.push_str("], ");
        let kind = match &func.kind {
            FunctionKind::Freestanding => "''",
            FunctionKind::Method(_) => "'method'",
            FunctionKind::Static(_) => "'static'",
            FunctionKind::Constructor(_) => "'constructor'",
            FunctionKind::AsyncFreestanding => "'async'",
            FunctionKind::AsyncMethod(_) => "'async method'",
            FunctionKind::AsyncStatic(_) => "'async static'",
            FunctionKind::Getter
            | FunctionKind::Setter
            | FunctionKind::MethodGetter(_)
            | FunctionKind::MethodSetter(_)
            | FunctionKind::StaticGetter(_)
            | FunctionKind::StaticSetter(_) => todo!(),
        };
        iface.src.push_str(kind);
        // The WIT name, e.g. `[method]request.get-method`, which jco's options refer to.
        iface.src.push_str(&format!(", '{}'", func.name));
        iface.src.push_str("),\n");
    }
    fn interface(&mut self, name: &str, id: InterfaceId) -> String {
        let id_name = self.resolve.id_of(id).unwrap_or_else(|| name.to_string());
        let identifier = interface_type_name(&id_name);
        let (identifier, seen) = self
            .local_names
            .get_or_create(&id_name, &identifier);
        let identifier = identifier.to_string();
        if seen {
            return identifier;
        }
        let mut defs = Bindgen::new(&self.resolve);
        defs.type_defs(id);
        self.src
            .push_str(&format!("{identifier} = IDL.Interface('{id_name}', {{\n"));
        let iface = &self.resolve.interfaces[id];
        for (_, func) in &iface.functions {
            self.func(func);
        }
        // Resources without functions in this world are only known from the type defs.
        for resource in std::mem::take(&mut defs.resources).into_keys() {
            self.resources
                .entry(resource)
                .or_insert_with(|| Bindgen::new(self.resolve));
        }
        // insert resources after type defs
        defs.emit_resources(&self.resources, &id_name);
        defs.src
            .prepend_str(&format!("let {identifier}; // {id_name}\n{{\n"));
        self.src.prepend_str(&defs.src);

        self.src.push_str("}, {");
        for v in self.resources.keys().chain(defs.defs.iter()) {
            self.src.push_str(&format!("'{v}': {v}, "));
        }
        self.src.push_str("});\n}\n");
        identifier
    }
    // The world-level functions, as the interface `UNNAMED`, held in the JS constant `constant`.
    fn world_funcs(&mut self, constant: &str, funcs: &[&Function]) -> bool {
        if funcs.is_empty() {
            return false;
        }
        self.src.push_str(&format!(
            "const {constant} = IDL.Interface('UNNAMED', {{\n"
        ));
        for func in funcs {
            self.func(func);
        }
        self.src.push_str("});\n");
        true
    }
    fn exported_funcs(&mut self, funcs: &[&Function]) {
        if self.world_funcs("UNNAMED", funcs) {
            self.export_interfaces.push("UNNAMED".to_string());
        }
    }
    // jco imports each world-level function as a module of its own, named as in WIT.
    fn imported_funcs(&mut self, funcs: &[&Function]) {
        if self.world_funcs("UNNAMED_IMPORTS", funcs) {
            self.import_interfaces.push("UNNAMED_IMPORTS".to_string());
        }
    }
    // Resources are emitted in the interface that defines them, `owner`; others `use` them.
    fn emit_resources(&mut self, resources: &BTreeMap<String, Bindgen>, owner: &str) {
        for (resource, src) in resources {
            self.src
                .prepend_str(&format!("const {resource} = IDL.Rec();\n"));
            self.src
                .push_str(&format!("{resource}.fill(IDL.Resource('{resource}', {{\n"));
            self.src.push_str(&src.src);
            self.src.push_str(&format!("}}, '{owner}'));\n"));
        }
    }
    fn module_return(&mut self) {
        self.src.push_str("return { exports: [");
        self.src.push_str(&self.export_interfaces.join(", "));
        self.src.push_str("], imports: [");
        self.src.push_str(&self.import_interfaces.join(", "));
        self.src.push_str("] };\n}\n");
    }
}

pub fn generate_ast(component: &[u8]) -> Result<String> {
    let decoded = wit_component::decode(component)?;
    let (mut resolve, id) = match decoded {
        DecodedWasm::Component(resolve, world_id) => (resolve, world_id),
        _ => unimplemented!(),
    };
    // Import each semver track of an interface once, e.g. `wasi:io/streams@0.2.0` and `@0.2.3` as
    // 0.2.3, so that both share its types; 0.3.0 stays separate.
    resolve.merge_world_imports_based_on_semver(id)?;
    let world = &resolve.worlds[id];
    let mut bindgen = Bindgen::new(&resolve);
    bindgen
        .src
        .push_str("export const Factory = ({IDL}) => {\n");
    let mut import_funcs = Vec::new();
    for (name, import) in &world.imports {
        match import {
            WorldItem::Interface { id, .. } => {
                let name = match name {
                    WorldKey::Name(export) => export,
                    WorldKey::Interface(interface) => &resolve.id_of(*interface).unwrap(),
                };
                let mut iface = bindgen.fork();
                let id = iface.interface(name, *id);
                bindgen.src.push_str(&iface.src);
                bindgen.import_interfaces.push(id);
                bindgen.local_names = iface.local_names;
            }
            WorldItem::Function(f) => import_funcs.push(f),
            _ => (),
        }
    }
    bindgen.imported_funcs(&import_funcs);
    let mut funcs = Vec::new();
    for (name, export) in &world.exports {
        match export {
            WorldItem::Interface { id, .. } => {
                let name = match name {
                    WorldKey::Name(export) => export,
                    WorldKey::Interface(interface) => &resolve.id_of(*interface).unwrap(),
                };
                let mut iface = bindgen.fork();
                let id = iface.interface(name, *id);
                bindgen.src.push_str(&iface.src);
                bindgen.export_interfaces.push(id);
                bindgen.local_names = iface.local_names;
            }
            WorldItem::Function(f) => funcs.push(f),
            WorldItem::Type { .. } => unimplemented!(),
        }
    }
    bindgen.exported_funcs(&funcs);
    bindgen.module_return();
    Ok(bindgen.src.to_string())
}

fn interface_type_name(iface_name: &str) -> String {
    let iface_name_sans_version = match iface_name.find('@') {
        Some(version_idx) => &iface_name[0..version_idx],
        None => iface_name,
    };
    iface_name_sans_version
        .replace(['/', ':'], "-")
        .to_upper_camel_case()
}
