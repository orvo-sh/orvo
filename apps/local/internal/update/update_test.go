package update

import "testing"

func TestIsNewer(t *testing.T) {
	tests := []struct {
		candidate string
		current   string
		want      bool
	}{
		{candidate: "1.1.0", current: "1.0.9", want: true},
		{candidate: "1.0.0", current: "1.0.0", want: false},
		{candidate: "1.0.0", current: "1.1.0", want: false},
		{candidate: "1.0.0", current: "1.0.0-beta.1", want: true},
		{candidate: "1.0.0-beta.1", current: "1.0.0", want: false},
		{candidate: "1.0.0", current: "dev", want: true},
	}

	for _, test := range tests {
		t.Run(test.candidate+"_from_"+test.current, func(t *testing.T) {
			if got := isNewer(test.candidate, test.current); got != test.want {
				t.Fatalf("isNewer(%q, %q) = %v, want %v", test.candidate, test.current, got, test.want)
			}
		})
	}
}
