package assets

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
)

func Prepare(cacheDir string, version string) (string, bool, error) {
	archive := runtimeArchive()
	if len(archive) == 0 {
		return "", false, nil
	}

	root := filepath.Join(cacheDir, "runtime", version)
	marker := filepath.Join(root, ".ready")
	if _, err := os.Stat(marker); err == nil {
		return root, true, nil
	}

	if err := os.MkdirAll(filepath.Dir(root), 0o700); err != nil {
		return "", false, fmt.Errorf("create runtime cache directory: %w", err)
	}
	temporary, err := os.MkdirTemp(filepath.Dir(root), ".extract-*")
	if err != nil {
		return "", false, fmt.Errorf("create runtime extraction directory: %w", err)
	}
	defer os.RemoveAll(temporary)

	compressed, err := gzip.NewReader(bytes.NewReader(archive))
	if err != nil {
		return "", false, fmt.Errorf("open embedded runtime: %w", err)
	}
	defer compressed.Close()

	reader := tar.NewReader(compressed)
	for {
		header, err := reader.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return "", false, fmt.Errorf("read embedded runtime: %w", err)
		}

		cleanName := filepath.Clean(header.Name)
		if cleanName == "." {
			continue
		}
		target := filepath.Join(temporary, cleanName)
		if !strings.HasPrefix(target, temporary+string(os.PathSeparator)) {
			return "", false, fmt.Errorf("embedded runtime contains an invalid path %q", header.Name)
		}

		switch header.Typeflag {
		case tar.TypeDir:
			if err := os.MkdirAll(target, os.FileMode(header.Mode)); err != nil {
				return "", false, fmt.Errorf("create embedded runtime directory: %w", err)
			}
		case tar.TypeReg:
			if err := os.MkdirAll(filepath.Dir(target), 0o700); err != nil {
				return "", false, fmt.Errorf("create embedded runtime parent: %w", err)
			}
			file, err := os.OpenFile(target, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, os.FileMode(header.Mode))
			if err != nil {
				return "", false, fmt.Errorf("create embedded runtime file: %w", err)
			}
			if _, err := io.Copy(file, reader); err != nil {
				_ = file.Close()
				return "", false, fmt.Errorf("extract embedded runtime file: %w", err)
			}
			if err := file.Close(); err != nil {
				return "", false, fmt.Errorf("close embedded runtime file: %w", err)
			}
		case tar.TypeSymlink:
			linkTarget := filepath.Clean(filepath.Join(filepath.Dir(target), header.Linkname))
			if filepath.IsAbs(header.Linkname) || !strings.HasPrefix(linkTarget, temporary+string(os.PathSeparator)) {
				continue
			}
			if err := os.MkdirAll(filepath.Dir(target), 0o700); err != nil {
				return "", false, fmt.Errorf("create embedded runtime link parent: %w", err)
			}
			if err := os.Symlink(header.Linkname, target); err != nil {
				return "", false, fmt.Errorf("create embedded runtime link: %w", err)
			}
		}
	}

	if err := os.WriteFile(filepath.Join(temporary, ".ready"), []byte(version+"\n"), 0o600); err != nil {
		return "", false, fmt.Errorf("mark embedded runtime ready: %w", err)
	}
	if err := os.RemoveAll(root); err != nil {
		return "", false, fmt.Errorf("replace embedded runtime: %w", err)
	}
	if err := os.Rename(temporary, root); err != nil {
		return "", false, fmt.Errorf("install embedded runtime: %w", err)
	}

	return root, true, nil
}
