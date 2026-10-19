"""
Tests for restructure_java_puzzle, which regroups CodeTailor's one-line-per-block
Java puzzles: opening braces join their header, closing braces are labeled, and
same-indentation statements share a block, with paired distractors following the
block their correct lines end up in.
"""

from rsptx.book_server_api.routers.personalized_parsons.java_puzzle_blocks import (
    restructure_java_puzzle,
)


def _blocks(puzzle):
    return [b.strip("\n") for b in puzzle.split("---")]


# CodeTailor's "Solution" puzzle for a constructor problem: one line per
# block, and a paired distractor built from the student's code.
_STUDENT = """\
    public class Student
---
    {
---
        private String name;
---
        private int grade;
---
        public Student(String name, int grade)
---
        {
---
            this.name = name;
            this.grade = grade;
---
            name = name;
            grade = grade; #paired
---
        }
---
        public static void main(String[] args)
---
        {
---
            Student s = new Student("Ana", 10);
---
            System.out.println(s.name);
---
        }
---
    }
"""


def test_braces_join_headers_and_closing_braces_are_labeled():
    blocks = _blocks(restructure_java_puzzle(_STUDENT))
    assert blocks[0] == "    public class Student\n    {"
    assert "        public Student(String name, int grade)\n        {" in blocks
    assert "        } // end constructor" in blocks
    assert "        } // end main" in blocks
    assert blocks[-1] == "    } // end class"


def test_same_indentation_statements_share_a_block():
    blocks = _blocks(restructure_java_puzzle(_STUDENT))
    assert "        private String name;\n        private int grade;" in blocks
    assert (
        '            Student s = new Student("Ana", 10);\n'
        "            System.out.println(s.name);"
    ) in blocks


def test_paired_distractor_follows_its_block():
    blocks = _blocks(restructure_java_puzzle(_STUDENT))
    correct = blocks.index(
        "            this.name = name;\n            this.grade = grade;"
    )
    assert blocks[correct + 1] == (
        "            name = name;\n            grade = grade; #paired"
    )


def test_distractor_is_swapped_into_a_merged_block():
    puzzle = """\
public class A
---
{
---
    void f()
---
    {
---
        int x = 1;
---
        int y = 2;
---
        int y = 3; #paired
---
    }
---
}
"""
    blocks = _blocks(restructure_java_puzzle(puzzle))
    i = blocks.index("        int x = 1;\n        int y = 2;")
    assert blocks[i + 1] == "        int x = 1;\n        int y = 3; #paired"
    assert "    } // end f" in blocks


def test_lines_shared_with_a_distractor_regroup_normally():
    # CodeTailor paired the constructor's closing brace and the next method's
    # header and brace with a distractor that differs only in the header.
    puzzle = """\
public class PizzaOrder
---
{
---
    public PizzaOrder(int slices)
---
    {
---
        this.slices = slices;
---
    }
    public static void setPrice(double price)
    {
---
    }
    public void setPrice(double price)
    { #paired
---
        pricePerSlice = price;
---
    }
---
}
"""
    blocks = _blocks(restructure_java_puzzle(puzzle))
    assert "    } // end constructor" in blocks
    i = blocks.index("    public static void setPrice(double price)\n    {")
    assert blocks[i + 1] == "    public void setPrice(double price)\n    { #paired"
    assert "    } // end setPrice" in blocks


def test_control_structures_are_labeled():
    puzzle = """\
public class T
---
{
---
    public int getPrice()
---
    {
---
        if (age < 12)
---
        {
---
            return 5;
---
        }
---
        else
---
        {
---
            return 10;
---
        }
---
        for (int i = 0; i < 3; i++)
---
        {
---
            age++;
---
        }
---
    }
---
}
"""
    blocks = _blocks(restructure_java_puzzle(puzzle))
    assert "        if (age < 12)\n        {" in blocks
    assert "        else\n        {" in blocks
    assert blocks.count("        } // end if") == 1
    assert "        } // end else" in blocks
    assert "        } // end for" in blocks
    assert "    } // end getPrice" in blocks


def test_settled_puzzles_are_unchanged():
    puzzle = (
        "public class A #settled\n---\n{ #settled\n---\n    int x;\n---\n} #settled\n"
    )
    assert restructure_java_puzzle(puzzle) == puzzle
