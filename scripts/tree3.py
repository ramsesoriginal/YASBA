import os

MAX_DEPTH = 3

def is_hidden(name: str) -> bool:
    return name.startswith(".")

def list_entries(path, depth):
    try:
        entries = os.listdir(path)
    except PermissionError:
        return None

    out = []
    for name in entries:
        full = os.path.join(path, name)
        hidden = is_hidden(name)

        if os.path.isdir(full) and hidden:
            continue

        if depth == 0:
            out.append(name)
        else:
            if hidden:
                continue
            out.append(name)

    out.sort(key=lambda n: (not os.path.isdir(os.path.join(path, n)), n.lower()))
    return out

def walk(path, depth, prefix=""):
    entries = list_entries(path, depth)
    if entries is None:
        print(prefix + "└── [permission denied]")
        return

    for i, name in enumerate(entries):
        full = os.path.join(path, name)
        last = (i == len(entries) - 1)

        print(prefix + ("└── " if last else "├── ") + name)

        if os.path.isdir(full) and depth < MAX_DEPTH - 1:
            walk(full, depth + 1, prefix + ("    " if last else "│   "))

def main():
    print(".")
    walk(".", 0)

if __name__ == "__main__":
    main()
