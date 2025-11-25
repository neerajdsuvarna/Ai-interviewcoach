import React, { useState, useRef, useEffect } from 'react';
import { Editor } from '@monaco-editor/react';
import { motion } from 'framer-motion';
import {
  PlayIcon,
  StopIcon,
  BugAntIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  CodeBracketIcon,
  ClockIcon,
  CpuChipIcon,
  ArrowRightEndOnRectangleIcon
} from '@heroicons/react/24/outline';

const CodeEditor = ({
  initialCode = '',
  language = 'javascript',
  onCodeChange,
  onRun,
  onTest,
  onSave,
  saveLang,
  isRunning = false,
  output = '',
  errors = '',
  testResults = null,
  executionTime = 0
}) => {
  const [code, setCode] = useState(initialCode);
  const [canRun, setCanRun] = useState(true);
  const [canTest, setCanTest] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState(language);
  const [fontSize, setFontSize] = useState(14);
  const [theme, setTheme] = useState('vs-dark');
  const editorRef = useRef(null);

  const languages = [
    { value: 'javascript', label: 'JavaScript', extension: '.js' },
    { value: 'python', label: 'Python', extension: '.py' },
    { value: 'java', label: 'Java', extension: '.java' },
    { value: 'cpp', label: 'C++', extension: '.cpp' },
    { value: 'csharp', label: 'C#', extension: '.cs' },
    { value: 'go', label: 'Go', extension: '.go' },
    { value: 'rust', label: 'Rust', extension: '.rs' },
    { value: 'typescript', label: 'TypeScript', extension: '.ts' },
    { value: 'sql', label: 'SQL', extension: '.sql'}
  ];

  const themes = [
    { value: 'vs-dark', label: 'Dark' },
    { value: 'vs-light', label: 'Light' },
    { value: 'hc-black', label: 'High Contrast' }
  ];

  const defaultCode = {
    javascript: `// Welcome to the Code Editor!
function fibonacci(n) {
    if (n <= 1) return n;
    return fibonacci(n - 1) + fibonacci(n - 2);
}

// Test the function
console.log("Fibonacci sequence:");
for (let i = 0; i < 10; i++) {
    console.log(\`F(\${i}) = \${fibonacci(i)}\`);
}`,
    python: `# Welcome to the Code Editor!
def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)

# Test the function
print("Fibonacci sequence:")
for i in range(10):
    print(f"F({i}) = {fibonacci(i)}")`,
    java: `// Welcome to the Code Editor!
public class Main {
    public static int fibonacci(int n) {
        if (n <= 1) return n;
        return fibonacci(n - 1) + fibonacci(n - 2);
    }

    public static void main(String[] args) {
        System.out.println("Fibonacci sequence:");
        for (int i = 0; i < 10; i++) {
            System.out.println("F(" + i + ") = " + fibonacci(i));
        }
    }
}`,
    cpp: `// Welcome to the Code Editor!
#include <iostream>
using namespace std;

int fibonacci(int n) {
    if (n <= 1) return n;
    return fibonacci(n - 1) + fibonacci(n - 2);
}

int main() {
    cout << "Fibonacci sequence:" << endl;
    for (int i = 0; i < 10; i++) {
        cout << "F(" << i << ") = " << fibonacci(i) << endl;
    }
    return 0;
}`,
    csharp: `// Welcome to the Code Editor!
using System;

class Program {
    static int Fibonacci(int n) {
        if (n <= 1) return n;
        return Fibonacci(n - 1) + Fibonacci(n - 2);
    }

    static void Main() {
        Console.WriteLine("Fibonacci sequence:");
        for (int i = 0; i < 10; i++) {
            Console.WriteLine($"F({i}) = {Fibonacci(i)}");
        }
    }
}`,
    go: `// Welcome to the Code Editor!
package main

import "fmt"

func fibonacci(n int) int {
    if n <= 1 {
        return n
    }
    return fibonacci(n-1) + fibonacci(n-2)
}

func main() {
    fmt.Println("Fibonacci sequence:")
    for i := 0; i < 10; i++ {
        fmt.Printf("F(%d) = %d\n", i, fibonacci(i))
    }
}`,
    rust: `// Welcome to the Code Editor!
fn fibonacci(n: u32) -> u32 {
    if n <= 1 {
        return n;
    }
    fibonacci(n - 1) + fibonacci(n - 2)
}

fn main() {
    println!("Fibonacci sequence:");
    for i in 0..10 {
        println!("F({}) = {}", i, fibonacci(i));
    }
}`,
    typescript: `// Welcome to the Code Editor!
function fibonacci(n: number): number {
    if (n <= 1) return n;
    return fibonacci(n - 1) + fibonacci(n - 2);
}

// Test the function
console.log("Fibonacci sequence:");
for (let i = 0; i < 10; i++) {
    console.log(\`F(\${i}) = \${fibonacci(i)}\`);
}`,
    sql: `SELECT *
    FROM table
    WHERE attribute = condition`
  };

  useEffect(() => {
    if (onCodeChange) {
      onCodeChange(code);
    }
  }, [code, onCodeChange]);

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;

    // Configure editor options
    editor.updateOptions({
      minimap: { enabled: true },
      scrollBeyondLastLine: false,
      automaticLayout: true,
      fontSize: fontSize,
      wordWrap: 'on',
      lineNumbers: 'on',
      renderWhitespace: 'selection',
      selectOnLineNumbers: true,
      roundedSelection: false,
      readOnly: false,
      cursorStyle: 'line',
      automaticLayout: true,
    });

    // Add custom keybindings
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      handleRun();
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Enter, () => {
      handleTest();
    });

    editor.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.Enter, () => {
      handleSave();
    });
  };

  const handleCodeChange = (value) => {
    setCode(value || '');
  };

  const handleLanguageChange = (newLanguage) => {
    setSelectedLanguage(newLanguage);
    if (defaultCode[newLanguage] && (initialCode == '')) {
      setCode(defaultCode[newLanguage]);
    }
    if(newLanguage == 'sql') {
          setCanRun(false);
          setCanTest(false);
    } else {
        setCanRun(true);
        setCanTest(true);
    }
    saveLang(newLanguage);
  };

  const handleRun = () => {
    if (onRun) {
      onRun(code, selectedLanguage);
    }
  };

  const handleTest = () => {
    if (onTest) {
      onTest(code, selectedLanguage);
    }
  };

  const handleSave = () => {
      if (onSave) {
          onSave(code);
      }
  };

  const handleClear = () => {
    setCode('');
  };


  const handleReset = () => {
    if (defaultCode[selectedLanguage]) {
      setCode(defaultCode[selectedLanguage]);
    }
  };

  const getStatusIcon = () => {
    if (isRunning) {
      return <ClockIcon className="w-5 h-5 text-blue-500 animate-spin" />;
    }
    if (errors) {
      return <ExclamationTriangleIcon className="w-5 h-5 text-red-500" />;
    }
    if (testResults && testResults.passed > 0) {
      return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
    }
    return <CodeBracketIcon className="w-5 h-5 text-gray-500" />;
  };

  const getStatusText = () => {
    if (isRunning) return 'Running...';
    if (errors) return 'Error';
    if (testResults && testResults.passed > 0) return 'Tests Passed';
    return 'Ready';
  };


  return (
    <div className="h-full flex flex-col bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-4 bg-[var(--color-card)] border-b border-[var(--color-border)] space-y-3 sm:space-y-0">
        <div className="flex items-center space-x-2 sm:space-x-4">
          <div className="flex items-center space-x-2">
            {getStatusIcon()}
            <span className="text-xs sm:text-sm font-medium text-[var(--color-text-primary)]">
              {getStatusText()}
            </span>
            {executionTime > 0 && (
              <span className="text-xs text-[var(--color-text-secondary)] flex items-center">
                <CpuChipIcon className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                {executionTime}ms
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-3 w-full sm:w-auto">
          {/* Language Selector */}
          <select
            value={selectedLanguage}
            onChange={(e) => handleLanguageChange(e.target.value)}
            className="w-full sm:w-auto px-2 sm:px-3 py-1.5 text-xs sm:text-sm bg-[var(--color-bg)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          >
            {languages.map((lang) => (
              <option key={lang.value} value={lang.value}>
                {lang.label}
              </option>
            ))}
          </select>

          {/* Theme Selector */}
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            className="w-full sm:w-auto px-2 sm:px-3 py-1.5 text-xs sm:text-sm bg-[var(--color-bg)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          >
            {themes.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>

          {/* Font Size - Hidden on mobile */}
          <div className="hidden sm:flex items-center space-x-2">
            <span className="text-xs text-[var(--color-text-secondary)]">Font:</span>
            <input
              type="range"
              min="10"
              max="20"
              value={fontSize}
              onChange={(e) => setFontSize(parseInt(e.target.value))}
              className="w-16"
            />
            <span className="text-xs text-[var(--color-text-secondary)] w-6">{fontSize}px</span>
          </div>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 relative">
        <Editor
          height="100%"
          language={selectedLanguage}
          value={code}
          theme={theme}
          onChange={handleCodeChange}
          onMount={handleEditorDidMount}
          options={{
            fontSize: fontSize,
            minimap: { enabled: true },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            wordWrap: 'on',
            lineNumbers: 'on',
            renderWhitespace: 'selection',
            selectOnLineNumbers: true,
            roundedSelection: false,
            readOnly: false,
            cursorStyle: 'line',
            automaticLayout: true,
            tabSize: 2,
            insertSpaces: true,
            detectIndentation: true,
            formatOnPaste: true,
            formatOnType: true,
            suggestOnTriggerCharacters: true,
            acceptSuggestionOnEnter: 'on',
            quickSuggestions: true,
            parameterHints: { enabled: true },
            hover: { enabled: true },
            contextmenu: true,
            mouseWheelZoom: true,
            smoothScrolling: true,
            cursorBlinking: 'blink',
            cursorSmoothCaretAnimation: true,
          }}
        />
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 sm:p-4 bg-[var(--color-card)] border-t border-[var(--color-border)] space-y-3 sm:space-y-0">
        <div className="flex items-center space-x-2">
          <button
            onClick={handleClear}
            className="px-2 sm:px-3 py-1.5 text-xs sm:text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg)] rounded-md transition-colors"
          >
            Clear
          </button>
          <button
            onClick={handleReset}
            className="px-2 sm:px-3 py-1.5 text-xs sm:text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg)] rounded-md transition-colors"
          >
            Reset
          </button>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-3 w-full sm:w-auto">
            {canTest && (
          <button
            onClick={handleTest}
            disabled={isRunning || !canTest}
            className="flex-1 sm:flex-none flex items-center justify-center space-x-1 sm:space-x-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors"
          >
            <BugAntIcon className="w-3 h-3 sm:w-4 sm:h-4" />
            <span>Test</span>
          </button>
          )}
          {canRun && (
          <button
            onClick={handleRun}
            disabled={isRunning || !canRun}
            className="flex-1 sm:flex-none flex items-center justify-center space-x-1 sm:space-x-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/90 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors"
          >
            {isRunning ? (
              <StopIcon className="w-3 h-3 sm:w-4 sm:h-4" />
            ) : (
              <PlayIcon className="w-3 h-3 sm:w-4 sm:h-4" />
            )}
            <span>{isRunning ? 'Stop' : 'Run'}</span>
          </button>
          )}
          <button
            onClick={handleSave}
            disabled={isRunning}
            className="flex-1 sm:flex-none flex items-center justify-center space-x-1 sm:space-x-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors"
          >
            <ArrowRightEndOnRectangleIcon className="w-3 h-3 sm:w-4 sm:h-4" />
            <span>Save</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default CodeEditor;