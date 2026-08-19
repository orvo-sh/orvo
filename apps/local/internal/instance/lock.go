package instance

import (
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"syscall"
)

type Lock struct {
	file *os.File
}

func Acquire(dataDir string) (*Lock, error) {
	path := filepath.Join(dataDir, "orvo.lock")
	file, err := os.OpenFile(path, os.O_CREATE|os.O_RDWR, 0o600)
	if err != nil {
		return nil, fmt.Errorf("open instance lock: %w", err)
	}
	if err := syscall.Flock(int(file.Fd()), syscall.LOCK_EX|syscall.LOCK_NB); err != nil {
		_ = file.Close()
		return nil, fmt.Errorf("Orvo Local is already running")
	}
	if err := file.Truncate(0); err != nil {
		_ = file.Close()
		return nil, fmt.Errorf("truncate instance lock: %w", err)
	}
	if _, err := file.WriteString(strconv.Itoa(os.Getpid())); err != nil {
		_ = file.Close()
		return nil, fmt.Errorf("write instance lock: %w", err)
	}
	return &Lock{file: file}, nil
}

func (lock *Lock) Close() error {
	if err := syscall.Flock(int(lock.file.Fd()), syscall.LOCK_UN); err != nil {
		return fmt.Errorf("unlock instance: %w", err)
	}
	return lock.file.Close()
}

func Status(dataDir string) string {
	bytes, err := os.ReadFile(filepath.Join(dataDir, "orvo.lock"))
	if err != nil || len(bytes) == 0 {
		return "stopped"
	}
	pid, err := strconv.Atoi(string(bytes))
	if err != nil {
		return "stopped"
	}
	process, err := os.FindProcess(pid)
	if err != nil || process.Signal(syscall.Signal(0)) != nil {
		return "stopped"
	}
	return fmt.Sprintf("running (pid %d)", pid)
}
