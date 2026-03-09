
with open('src/App.jsx', 'r', encoding='utf-8') as f:
    text = f.readlines()

brace_stack = []
for i, line in enumerate(text):
    for char in line:
        if char == '{':
            brace_stack.append(i + 1)
        elif char == '}':
            if brace_stack:
                brace_stack.pop()
            else:
                print(f"Extra closing brace at line {i+1}")

print(f"Brace stack at end: {brace_stack}")
