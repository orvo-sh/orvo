//go:build release

package assets

import _ "embed"

//go:embed runtime.tar.gz
var archive []byte

func runtimeArchive() []byte { return archive }
