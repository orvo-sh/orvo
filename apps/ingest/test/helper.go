package test

import (
	"fmt"
	"reflect"
	"testing"
)

func compareValues(t *testing.T, path string, expected, actual any) {
	t.Helper()

	ev := reflect.ValueOf(expected)
	av := reflect.ValueOf(actual)

	if ev.IsValid() && av.IsValid() && ev.Kind() == reflect.Slice && av.Kind() == reflect.Slice {
		if ev.Len() != av.Len() {
			t.Errorf("%s: length mismatch: expected %d, got %d", path, ev.Len(), av.Len())
			return
		}

		for index := range make([]struct{}, ev.Len()) {
			compareValues(t, fmt.Sprintf("%s[%d]", path, index), ev.Index(index).Interface(), av.Index(index).Interface())
		}

		return
	}

	if !reflect.DeepEqual(expected, actual) {
		t.Errorf("%s: mismatch:\nexpected %#v (%T)\ngot      %#v (%T)", path, expected, expected, actual, actual)
	}
}
