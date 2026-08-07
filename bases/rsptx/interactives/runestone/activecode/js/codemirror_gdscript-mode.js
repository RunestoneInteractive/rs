/* codemirror_gdscript-mode.js */

export function registerGDScriptMode(CodeMirror) {
    CodeMirror.defineMode("gdscript", function() {
        return {
            startState: function() {
                return { tokenize: null };
            },
            token: function(stream, state) {
                if (stream.eatSpace()) return null;

                // 1. Line Comments
                if (stream.match(/^#.*/)) return "comment";

                // 2. GDScript 4 StringNames (&"") and NodePaths (^"")
                if (stream.match(/^&"([^"\\]|\\.)*"/) || stream.match(/^&'([^'\\]|\\.)*'/)) return "string-2";
                if (stream.match(/^\^"([^"\\]|\\.)*"/) || stream.match(/^\^'([^'\\]|\\.)*'/)) return "string-2";

                // 3. Standard Strings
                if (stream.match(/^"([^"\\]|\\.)*"/) || stream.match(/^'([^'\\]|\\.)*'/)) return "string";

                // 4. Godot 4 Annotations (@export, @onready, @tool)
                if (stream.match(/^@[a-zA-Z_]\w*/)) return "meta";

                // 5. Node Access Shorthands ($Path or %UniqueNode)
                if (stream.match(/^\$[a-zA-Z_]\w*/) || stream.match(/^%[a-zA-Z_]\w*/)) return "variable-3";

                // 6. Keywords
                const keywords = /^(extends|class_name|class|const|var|func|return|if|elif|else|for|while|match|break|continue|pass|signal|await|breakpoint|rpc|super|self|static|enum|assert|preload|load)\b/;
                if (stream.match(keywords)) return "keyword";

                // 7a. Custom / Engine Classes (Catches Sprite2D, CharacterBody2D, Vector2, etc.)
                if (stream.match(/^[A-Z][a-zA-Z0-9_]*\b/)) return "builtin";

                // 7b. Lowercase Built-in Primitive Types (int, float, bool, string)
                if (stream.match(/^(int|float|bool)\b/)) return "builtin";

                // 8. Atoms and Constants
                if (stream.match(/^(true|false|null|PI|TAU|INF|NAN)\b/)) return "atom";

                // 9. Numbers (Hex, Binary, and standard digits with underscores)
                if (stream.match(/^(0x[0-9a-fA-F_]+|0b[01_]+|\d[\d_]*(\.\d[\d_]*)?)/)) return "number";

                stream.next();
                return null;
            }
        };
    });

    CodeMirror.defineMIME("text/x-gdscript", "gdscript");
}