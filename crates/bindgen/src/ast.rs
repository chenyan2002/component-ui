use crate::source::Source;
use anyhow::Result;
use heck::{ToLowerCamelCase, ToUpperCamelCase};
use wit_component::DecodedWasm;
use wit_parser::{Function, InterfaceId, Resolve, Type, TypeDefKind, WorldItem, WorldKey};

struct Bindgen<'a> {
    src: Source,
    resolve: &'a Resolve,
    export_interfaces: Vec<String>,
}
impl Bindgen<'_> {
    fn pp_optional_ty(&mut self, ty: Option<&Type>) {
        match ty {
            Some(ty) => self.pp_ty(ty),
            None => self.src.push_str("IDL.Null"),
        }
    }
    fn pp_ty_kind(&mut self, kind: &TypeDefKind) {
        match kind {
            // TODO: handle cross interface reference
            TypeDefKind::Type(t) => self.pp_ty(t),
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
                self.src.push_str("IDL.Variant({'ok': ");
                self.pp_optional_ty(r.ok.as_ref());
                self.src.push_str(", 'err': ");
                self.pp_optional_ty(r.err.as_ref());
                self.src.push_str("})");
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
            TypeDefKind::Future(_) | TypeDefKind::Stream(_) => todo!(),
            TypeDefKind::Resource | TypeDefKind::Handle(_) => todo!(),
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
                self.pp_ty_kind(&ty.kind);
            }
        }
    }
    fn type_defs(&mut self, iface_id: InterfaceId) {
        let iface = &self.resolve.interfaces[iface_id];
        for (name, id) in &iface.types {
            let name = name.to_upper_camel_case();
            self.src.push_str(&format!("const {name} = "));
            let ty = &self.resolve.types[*id];
            self.pp_ty_kind(&ty.kind);
            self.src.push_str(";\n");
        }
    }
    fn func(&mut self, func: &Function, _is_async: bool) {
        let out_name = func.item_name().to_lower_camel_case();
        self.src.push_str(&format!("'{out_name}': IDL.Func(["));
        for (i, (name, ty)) in func.params.iter().enumerate() {
            if i > 0 {
                self.src.push_str(", ");
            }
            self.src.push_str(&format!("['{name}', "));
            self.pp_ty(ty);
            self.src.push_str("]");
        }
        self.src.push_str("], [");
        if let Some(ty) = func.result {
            self.pp_ty(&ty);
        }
        self.src.push_str("]");
        self.src.push_str("),\n");
    }
    fn interface(&mut self, resolve: &Resolve, name: &str, id: InterfaceId) {
        let id_name = resolve.id_of(id).unwrap_or_else(|| name.to_string());
        let identifier = interface_type_name(&id_name);
        self.type_defs(id);
        self.src.push_str(&format!(
            "const {identifier} = IDL.Interface('{id_name}', {{\n"
        ));
        let iface = &resolve.interfaces[id];
        for (_, func) in &iface.functions {
            self.func(func, true);
        }
        self.src.push_str("});\n");
        self.export_interfaces.push(identifier);
    }
    fn exported_funcs(&mut self, funcs: &[&Function]) {
        if funcs.is_empty() {
            return;
        }
        let unnamed = "UNNAMED".to_string();
        self.src.push_str(&format!(
            "const {unnamed} = IDL.Interface('{unnamed}', {{\n"
        ));
        for func in funcs {
            self.func(func, true);
        }
        self.src.push_str("});\n");
        self.export_interfaces.push(unnamed);
    }
}

pub fn generate_ast(component: &[u8]) -> Result<String> {
    let decoded = wit_component::decode(component)?;
    let (resolve, id) = match decoded {
        DecodedWasm::Component(resolve, world_id) => (resolve, world_id),
        _ => unimplemented!(),
    };
    let world = &resolve.worlds[id];
    let mut bindgen = Bindgen {
        src: Source::default(),
        resolve: &resolve,
        export_interfaces: Vec::new(),
    };
    bindgen
        .src
        .push_str("export const Factory = ({IDL}) => {\n");
    let mut funcs = Vec::new();
    for (name, export) in &world.exports {
        match export {
            WorldItem::Interface { id, .. } => {
                let name = match name {
                    WorldKey::Name(export) => export,
                    WorldKey::Interface(interface) => &resolve.id_of(*interface).unwrap(),
                };
                bindgen.interface(&resolve, name, *id);
            }
            WorldItem::Function(f) => funcs.push(f),
            WorldItem::Type(_) => unimplemented!(),
        }
    }
    bindgen.exported_funcs(&funcs);
    bindgen.src.push_str("return [");
    bindgen.src.push_str(&bindgen.export_interfaces.join(", "));
    bindgen.src.push_str("];\n}\n");
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
