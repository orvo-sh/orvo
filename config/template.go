package config

import _ "embed"

//go:embed config.yaml.tmpl
var Template string
