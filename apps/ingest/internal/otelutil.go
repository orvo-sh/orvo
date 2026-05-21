package ingest

import (
	"encoding/hex"
	"encoding/json"
	"fmt"

	commonpb "go.opentelemetry.io/proto/otlp/common/v1"
)

func KvListToMap(kvs []*commonpb.KeyValue) map[string]string {
	if len(kvs) == 0 {
		return map[string]string{}
	}

	out := make(map[string]string, len(kvs))
	for _, kv := range kvs {
		out[kv.GetKey()] = AnyValueToString(kv.GetValue())
	}

	return out
}

func AnyValueToString(value *commonpb.AnyValue) string {
	if value == nil {
		return ""
	}

	switch typed := value.GetValue().(type) {
	case *commonpb.AnyValue_StringValue:
		return typed.StringValue
	case *commonpb.AnyValue_BoolValue:
		return fmt.Sprintf("%t", typed.BoolValue)
	case *commonpb.AnyValue_IntValue:
		return fmt.Sprintf("%d", typed.IntValue)
	case *commonpb.AnyValue_DoubleValue:
		return fmt.Sprintf("%g", typed.DoubleValue)
	case *commonpb.AnyValue_BytesValue:
		return hex.EncodeToString(typed.BytesValue)
	case *commonpb.AnyValue_ArrayValue, *commonpb.AnyValue_KvlistValue:
		bytes, err := json.Marshal(anyValueToInterface(value))
		if err != nil {
			return fmt.Sprintf("%v", value)
		}
		return string(bytes)
	default:
		return ""
	}
}

func anyValueToInterface(value *commonpb.AnyValue) any {
	if value == nil {
		return nil
	}

	switch typed := value.GetValue().(type) {
	case *commonpb.AnyValue_StringValue:
		return typed.StringValue
	case *commonpb.AnyValue_BoolValue:
		return typed.BoolValue
	case *commonpb.AnyValue_IntValue:
		return typed.IntValue
	case *commonpb.AnyValue_DoubleValue:
		return typed.DoubleValue
	case *commonpb.AnyValue_BytesValue:
		return hex.EncodeToString(typed.BytesValue)
	case *commonpb.AnyValue_ArrayValue:
		if typed.ArrayValue == nil {
			return nil
		}
		items := make([]any, len(typed.ArrayValue.GetValues()))
		for index, item := range typed.ArrayValue.GetValues() {
			items[index] = anyValueToInterface(item)
		}
		return items
	case *commonpb.AnyValue_KvlistValue:
		if typed.KvlistValue == nil {
			return nil
		}
		items := make(map[string]any, len(typed.KvlistValue.GetValues()))
		for _, kv := range typed.KvlistValue.GetValues() {
			items[kv.GetKey()] = anyValueToInterface(kv.GetValue())
		}
		return items
	default:
		return nil
	}
}
