//! WAVE for the UI, with the writer and parser of proxy-component's wasm-wave, so the two
//! tools encode values the same way.

use crate::exports::local::bindgen::wave::{TypeNode, ValueNode};
use std::borrow::Cow;
use wasm_wave::value::{Type, Value};
use wasm_wave::wasm::{WasmType, WasmTypeKind, WasmValue};

pub fn format(ty: &[TypeNode], value: &[ValueNode]) -> Result<String, String> {
    let ty = build_type(ty)?;
    let value = build_value(&ty, value, root(value)?)?;
    wasm_wave::to_string(&value).map_err(|e| e.to_string())
}

pub fn parse(ty: &[TypeNode], text: &str) -> Result<Vec<ValueNode>, String> {
    let ty = build_type(ty)?;
    let value: Value = wasm_wave::from_str(&ty, text).map_err(|e| e.to_string())?;
    let mut nodes = Vec::new();
    emit_value(&value, &mut nodes);
    Ok(nodes)
}

// The last node is the type or value itself.
fn root<T>(nodes: &[T]) -> Result<u32, String> {
    match nodes.len() {
        0 => Err("no nodes".to_string()),
        n => Ok(n as u32 - 1),
    }
}

fn node<T>(nodes: &[T], index: u32) -> Result<&T, String> {
    nodes.get(index as usize).ok_or_else(|| format!("no node {index}"))
}

fn build_type(nodes: &[TypeNode]) -> Result<Type, String> {
    type_at(nodes, root(nodes)?)
}

fn type_at(nodes: &[TypeNode], index: u32) -> Result<Type, String> {
    let get = |i: u32| type_at(nodes, i);
    let opt = |i: Option<u32>| i.map(get).transpose();
    let empty = || format!("empty type at node {index}");
    Ok(match node(nodes, index)? {
        TypeNode::Bool => Type::BOOL,
        TypeNode::S8 => Type::S8,
        TypeNode::S16 => Type::S16,
        TypeNode::S32 => Type::S32,
        TypeNode::S64 => Type::S64,
        TypeNode::U8 => Type::U8,
        TypeNode::U16 => Type::U16,
        TypeNode::U32 => Type::U32,
        TypeNode::U64 => Type::U64,
        TypeNode::F32 => Type::F32,
        TypeNode::F64 => Type::F64,
        TypeNode::Char => Type::CHAR,
        TypeNode::String => Type::STRING,
        TypeNode::List(elem) => Type::list(get(*elem)?),
        TypeNode::Record(fields) => {
            let fields = fields
                .iter()
                .map(|(name, ty)| Ok((name.as_str(), get(*ty)?)))
                .collect::<Result<Vec<_>, String>>()?;
            Type::record(fields).ok_or_else(empty)?
        }
        TypeNode::Tuple(elems) => {
            let elems = elems.iter().map(|ty| get(*ty)).collect::<Result<Vec<_>, _>>()?;
            Type::tuple(elems).ok_or_else(empty)?
        }
        TypeNode::Variant(cases) => {
            let cases = cases
                .iter()
                .map(|(name, ty)| Ok((name.as_str(), opt(*ty)?)))
                .collect::<Result<Vec<_>, String>>()?;
            Type::variant(cases).ok_or_else(empty)?
        }
        TypeNode::Enum(cases) => Type::enum_ty(cases.iter().map(String::as_str)).ok_or_else(empty)?,
        TypeNode::Option(some) => Type::option(get(*some)?),
        TypeNode::Result((ok, err)) => Type::result(opt(*ok)?, opt(*err)?),
        TypeNode::Flags(names) => Type::flags(names.iter().map(String::as_str)).ok_or_else(empty)?,
        // The parser reads any label; the name is only for messages.
        TypeNode::Handle => Type::handle("resource"),
    })
}

fn build_value(ty: &Type, nodes: &[ValueNode], index: u32) -> Result<Value, String> {
    let err = |e: wasm_wave::wasm::WasmValueError| e.to_string();
    let mismatch = || format!("node {index} doesn't match type {ty}");
    // The value of a payload, which has a type exactly when the value has one.
    let payload = |ty: Option<Type>, index: Option<u32>| match (ty, index) {
        (Some(ty), Some(i)) => build_value(&ty, nodes, i).map(Some),
        (None, None) => Ok(None),
        _ => Err(mismatch()),
    };
    let value = node(nodes, index)?;
    Ok(match (ty.kind(), value) {
        (WasmTypeKind::Bool, ValueNode::Bool(v)) => Value::make_bool(*v),
        (WasmTypeKind::S8, ValueNode::S8(v)) => Value::make_s8(*v),
        (WasmTypeKind::S16, ValueNode::S16(v)) => Value::make_s16(*v),
        (WasmTypeKind::S32, ValueNode::S32(v)) => Value::make_s32(*v),
        (WasmTypeKind::S64, ValueNode::S64(v)) => Value::make_s64(*v),
        (WasmTypeKind::U8, ValueNode::U8(v)) => Value::make_u8(*v),
        (WasmTypeKind::U16, ValueNode::U16(v)) => Value::make_u16(*v),
        (WasmTypeKind::U32, ValueNode::U32(v)) => Value::make_u32(*v),
        (WasmTypeKind::U64, ValueNode::U64(v)) => Value::make_u64(*v),
        (WasmTypeKind::F32, ValueNode::F32(v)) => Value::make_f32(*v),
        (WasmTypeKind::F64, ValueNode::F64(v)) => Value::make_f64(*v),
        (WasmTypeKind::Char, ValueNode::Char(v)) => Value::make_char(*v),
        (WasmTypeKind::String, ValueNode::String(v)) => Value::make_string(Cow::Borrowed(v)),
        (WasmTypeKind::List, ValueNode::List(items)) => {
            let elem = ty.list_element_type().ok_or_else(mismatch)?;
            let items = items.iter().map(|i| build_value(&elem, nodes, *i)).collect::<Result<Vec<_>, _>>()?;
            Value::make_list(ty, items).map_err(err)?
        }
        (WasmTypeKind::Record, ValueNode::Record(values)) => {
            let fields: Vec<_> = ty.record_fields().collect();
            if fields.len() != values.len() {
                return Err(mismatch());
            }
            let values = fields
                .iter()
                .zip(values)
                .map(|((name, ty), i)| Ok((name.as_ref(), build_value(ty, nodes, *i)?)))
                .collect::<Result<Vec<_>, String>>()?;
            Value::make_record(ty, values).map_err(err)?
        }
        (WasmTypeKind::Tuple, ValueNode::Tuple(values)) => {
            let elems: Vec<_> = ty.tuple_element_types().collect();
            if elems.len() != values.len() {
                return Err(mismatch());
            }
            let values = elems
                .iter()
                .zip(values)
                .map(|(ty, i)| build_value(ty, nodes, *i))
                .collect::<Result<Vec<_>, _>>()?;
            Value::make_tuple(ty, values).map_err(err)?
        }
        (WasmTypeKind::Variant, ValueNode::Variant((case, val))) => {
            let (_, case_ty) = ty
                .variant_cases()
                .find(|(name, _)| name == case)
                .ok_or_else(|| format!("no case {case} in {ty}"))?;
            Value::make_variant(ty, case, payload(case_ty, *val)?).map_err(err)?
        }
        (WasmTypeKind::Enum, ValueNode::Enum(case)) => Value::make_enum(ty, case).map_err(err)?,
        (WasmTypeKind::Option, ValueNode::Option(val)) => {
            let some = ty.option_some_type().ok_or_else(mismatch)?;
            let val = val.map(|i| build_value(&some, nodes, i)).transpose()?;
            Value::make_option(ty, val).map_err(err)?
        }
        (WasmTypeKind::Result, ValueNode::Result(val)) => {
            let (ok, error) = ty.result_types().ok_or_else(mismatch)?;
            let val = match val {
                Ok(i) => Ok(payload(ok, *i)?),
                Err(i) => Err(payload(error, *i)?),
            };
            Value::make_result(ty, val).map_err(err)?
        }
        (WasmTypeKind::Flags, ValueNode::Flags(names)) => {
            Value::make_flags(ty, names.iter().map(String::as_str)).map_err(err)?
        }
        (WasmTypeKind::Handle, ValueNode::Handle(label)) => Value::make_handle(Cow::Borrowed(label)),
        _ => return Err(mismatch()),
    })
}

// Appends the nodes of `value`, the ones it contains first, and returns its index.
fn emit_value(value: &Value, nodes: &mut Vec<ValueNode>) -> u32 {
    let mut emit = |v: &Value| emit_value(v, nodes);
    let node = match value.kind() {
        WasmTypeKind::Bool => ValueNode::Bool(value.unwrap_bool()),
        WasmTypeKind::S8 => ValueNode::S8(value.unwrap_s8()),
        WasmTypeKind::S16 => ValueNode::S16(value.unwrap_s16()),
        WasmTypeKind::S32 => ValueNode::S32(value.unwrap_s32()),
        WasmTypeKind::S64 => ValueNode::S64(value.unwrap_s64()),
        WasmTypeKind::U8 => ValueNode::U8(value.unwrap_u8()),
        WasmTypeKind::U16 => ValueNode::U16(value.unwrap_u16()),
        WasmTypeKind::U32 => ValueNode::U32(value.unwrap_u32()),
        WasmTypeKind::U64 => ValueNode::U64(value.unwrap_u64()),
        WasmTypeKind::F32 => ValueNode::F32(value.unwrap_f32()),
        WasmTypeKind::F64 => ValueNode::F64(value.unwrap_f64()),
        WasmTypeKind::Char => ValueNode::Char(value.unwrap_char()),
        WasmTypeKind::String => ValueNode::String(value.unwrap_string().into_owned()),
        WasmTypeKind::List => ValueNode::List(value.unwrap_list().map(|v| emit(&v)).collect()),
        WasmTypeKind::Record => ValueNode::Record(value.unwrap_record().map(|(_, v)| emit(&v)).collect()),
        WasmTypeKind::Tuple => ValueNode::Tuple(value.unwrap_tuple().map(|v| emit(&v)).collect()),
        WasmTypeKind::Variant => {
            let (case, val) = value.unwrap_variant();
            ValueNode::Variant((case.into_owned(), val.map(|v| emit(&v))))
        }
        WasmTypeKind::Enum => ValueNode::Enum(value.unwrap_enum().into_owned()),
        WasmTypeKind::Option => ValueNode::Option(value.unwrap_option().map(|v| emit(&v))),
        WasmTypeKind::Result => ValueNode::Result(match value.unwrap_result() {
            Ok(v) => Ok(v.map(|v| emit(&v))),
            Err(v) => Err(v.map(|v| emit(&v))),
        }),
        WasmTypeKind::Flags => ValueNode::Flags(value.unwrap_flags().map(Cow::into_owned).collect()),
        WasmTypeKind::Handle => ValueNode::Handle(value.unwrap_handle().into_owned()),
        // The types above are all a type node can build.
        kind => unreachable!("unexpected {kind} value"),
    };
    nodes.push(node);
    nodes.len() as u32 - 1
}
