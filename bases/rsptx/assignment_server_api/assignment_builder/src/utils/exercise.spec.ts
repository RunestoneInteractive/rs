import { Exercise } from "@/types/exercises";
import { TreeNode } from "@/types/treeNode";
import {
  createExerciseId,
  filterAvailableExercises,
  filterExercisesByFromSource,
  filterExercisesByQuestionType,
  filterOutExercisesByQuestionType,
  getExercisesWithoutReadings,
  getLeafNodes,
  getSelectedKeys,
  removeChildrenWithoutTitleImmutable
} from "@/utils/exercise";

const makeLeaf = (key: string, data: Record<string, unknown> = {}): TreeNode => ({
  key,
  data: { question_type: "mchoice", title: key, ...data }
});

const makeParent = (
  key: string,
  children: TreeNode[],
  data: Record<string, unknown> = {}
): TreeNode => ({
  key,
  data: { question_type: "section", title: key, ...data },
  children
});

const makeExercise = (overrides: Partial<Exercise> = {}): Exercise => ({
  id: 1,
  assignment_id: 1,
  question_id: 1,
  points: 1,
  timed: false,
  autograde: "all_or_nothing",
  which_to_grade: "last_answer",
  reading_assignment: false,
  sorting_priority: 1,
  activities_required: 0,
  use_llm: false,
  qnumber: "1",
  name: "exercise_one",
  subchapter: "sub",
  chapter: "ch",
  base_course: "base",
  htmlsrc: "",
  question_type: "mchoice",
  question_json: "{}",
  owner: "owner",
  tags: "",
  num: 1,
  numQuestions: 1,
  required: false,
  title: "Exercise One",
  topic: "topic",
  difficulty: 1,
  author: "author",
  description: "",
  is_private: false,
  from_source: false,
  ...overrides
});

describe("createExerciseId", () => {
  it("returns a string matching the expected pattern", () => {
    const id = createExerciseId();
    expect(id).toMatch(/^exercise_\d{8}_\d{1,4}$/);
  });

  it("includes today's date in YYYYMMDD format", () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = (today.getMonth() + 1).toString().padStart(2, "0");
    const day = today.getDate().toString().padStart(2, "0");
    const expectedDate = `${year}${month}${day}`;

    const id = createExerciseId();
    expect(id).toContain(`exercise_${expectedDate}_`);
  });

  it("generates unique ids on repeated calls", () => {
    const ids = new Set(Array.from({ length: 20 }, () => createExerciseId()));
    expect(ids.size).toBeGreaterThan(1);
  });
});

describe("getLeafNodes", () => {
  it("returns all nodes when tree has no children", () => {
    const tree = [makeLeaf("a"), makeLeaf("b")];
    const leaves = getLeafNodes(tree);
    expect(leaves).toHaveLength(2);
    expect(leaves.map((n) => n.key)).toEqual(["a", "b"]);
  });

  it("returns only leaf nodes from a nested tree", () => {
    const tree = [makeParent("root", [makeLeaf("child1"), makeLeaf("child2")])];
    const leaves = getLeafNodes(tree);
    expect(leaves).toHaveLength(2);
    expect(leaves.map((n) => n.key)).toEqual(["child1", "child2"]);
  });

  it("handles deeply nested trees", () => {
    const tree = [makeParent("level1", [makeParent("level2", [makeLeaf("deep_leaf")])])];
    const leaves = getLeafNodes(tree);
    expect(leaves).toHaveLength(1);
    expect(leaves[0].key).toBe("deep_leaf");
  });

  it("returns empty array for empty tree", () => {
    expect(getLeafNodes([])).toEqual([]);
  });

  it("handles mixed parent and leaf nodes at root level", () => {
    const tree = [makeLeaf("leaf_at_root"), makeParent("parent", [makeLeaf("child")])];
    const leaves = getLeafNodes(tree);
    expect(leaves).toHaveLength(2);
    expect(leaves.map((n) => n.key)).toEqual(["leaf_at_root", "child"]);
  });
});

describe("getSelectedKeys", () => {
  it("marks leaf node as checked when its key matches an exercise name", () => {
    const tree = [makeLeaf("ex1")];
    const exercises = [makeExercise({ name: "ex1" })];
    const result = getSelectedKeys(tree, exercises);
    expect(result["ex1"]).toEqual({ checked: true, partialChecked: false });
  });

  it("marks leaf node as unchecked when its key does not match any exercise", () => {
    const tree = [makeLeaf("ex2")];
    const exercises = [makeExercise({ name: "ex1" })];
    const result = getSelectedKeys(tree, exercises);
    expect(result["ex2"]).toEqual({ checked: false, partialChecked: false });
  });

  it("marks all nodes checked when checkedByDefault is true", () => {
    const tree = [makeLeaf("any_key")];
    const result = getSelectedKeys(tree, [], true);
    expect(result["any_key"]).toEqual({ checked: true, partialChecked: false });
  });

  it("marks parent as fully checked when all children are checked", () => {
    const tree = [makeParent("parent", [makeLeaf("child1"), makeLeaf("child2")])];
    const exercises = [makeExercise({ name: "child1" }), makeExercise({ id: 2, name: "child2" })];
    const result = getSelectedKeys(tree, exercises);
    expect(result["parent"]).toEqual({ checked: true, partialChecked: false });
  });

  it("marks parent as partialChecked when only some children are checked", () => {
    const tree = [makeParent("parent", [makeLeaf("child1"), makeLeaf("child2")])];
    const exercises = [makeExercise({ name: "child1" })];
    const result = getSelectedKeys(tree, exercises);
    expect(result["parent"]).toEqual({ checked: false, partialChecked: true });
  });

  it("marks parent as unchecked when no children are checked", () => {
    const tree = [makeParent("parent", [makeLeaf("child1"), makeLeaf("child2")])];
    const result = getSelectedKeys(tree, []);
    expect(result["parent"]).toEqual({ checked: false, partialChecked: false });
  });

  it("propagates partial check state up the tree", () => {
    const tree = [
      makeParent("grandparent", [makeParent("parent", [makeLeaf("child1"), makeLeaf("child2")])])
    ];
    const exercises = [makeExercise({ name: "child1" })];
    const result = getSelectedKeys(tree, exercises);
    expect(result["parent"]).toEqual({ checked: false, partialChecked: true });
    expect(result["grandparent"]).toEqual({ checked: false, partialChecked: true });
  });

  it("returns empty object for empty tree", () => {
    expect(getSelectedKeys([], [])).toEqual({});
  });
});

describe("filterAvailableExercises", () => {
  it("filters out nodes with question_type 'page'", () => {
    const nodes = [
      makeLeaf("q1", { question_type: "mchoice" }),
      makeLeaf("q2", { question_type: "page" })
    ];
    const result = filterAvailableExercises(nodes);
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe("q1");
  });

  it("adds level property to each node", () => {
    const nodes = [makeLeaf("q1", { question_type: "mchoice" })];
    const result = filterAvailableExercises(nodes);
    expect((result[0] as any).level).toBe(0);
  });

  it("increments level for nested children", () => {
    const nodes = [
      makeParent("parent", [makeLeaf("child", { question_type: "mchoice" })], {
        question_type: "section"
      })
    ];
    const result = filterAvailableExercises(nodes);
    expect((result[0] as any).level).toBe(0);
    expect((result[0].children![0] as any).level).toBe(1);
  });

  it("disables parent node when all children are 'page' type", () => {
    const nodes = [
      makeParent("parent", [makeLeaf("child", { question_type: "page" })], {
        question_type: "section"
      })
    ];
    const result = filterAvailableExercises(nodes);
    expect(result[0].disabled).toBe(true);
  });

  it("does not disable parent node when it has valid children", () => {
    const nodes = [
      makeParent("parent", [makeLeaf("child", { question_type: "mchoice" })], {
        question_type: "section"
      })
    ];
    const result = filterAvailableExercises(nodes);
    expect(result[0].disabled).toBe(false);
  });

  it("sets disabled to false for leaf nodes", () => {
    const nodes = [makeLeaf("q1", { question_type: "mchoice" })];
    const result = filterAvailableExercises(nodes);
    expect(result[0].disabled).toBe(false);
  });

  it("returns empty array for empty input", () => {
    expect(filterAvailableExercises([])).toEqual([]);
  });
});

describe("removeChildrenWithoutTitleImmutable", () => {
  it("removes nodes without a title", () => {
    const nodes = [makeLeaf("q1", { title: "Title One" }), { key: "q2", data: {} }];
    const result = removeChildrenWithoutTitleImmutable(nodes);
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe("q1");
  });

  it("filters children without title from parent", () => {
    const parent: TreeNode = {
      key: "parent",
      data: { title: "Parent Title" },
      children: [makeLeaf("child1", { title: "Child Title" }), { key: "child2", data: {} }]
    };
    const result = removeChildrenWithoutTitleImmutable([parent]);
    expect(result).toHaveLength(1);
    expect(result[0].children).toHaveLength(1);
    expect(result[0].children![0].key).toBe("child1");
  });

  it("removes parent when all its children have no title", () => {
    const parent: TreeNode = {
      key: "parent",
      data: { title: "Parent" },
      children: [{ key: "child", data: {} }]
    };
    const result = removeChildrenWithoutTitleImmutable([parent]);
    expect(result).toHaveLength(1);
    expect(result[0].children).toBeUndefined();
  });

  it("does not mutate original nodes", () => {
    const original: TreeNode[] = [makeLeaf("q1", { title: "Title" })];
    const copy = JSON.parse(JSON.stringify(original));
    removeChildrenWithoutTitleImmutable(original);
    expect(original).toEqual(copy);
  });

  it("returns empty array for empty input", () => {
    expect(removeChildrenWithoutTitleImmutable([])).toEqual([]);
  });
});

describe("getExercisesWithoutReadings", () => {
  it("excludes reading assignment exercises", () => {
    const exercises = [
      makeExercise({ name: "reading", reading_assignment: true }),
      makeExercise({ id: 2, name: "normal", reading_assignment: false })
    ];
    const result = getExercisesWithoutReadings(exercises);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("normal");
  });

  it("excludes exercises with question_type 'page'", () => {
    const exercises = [
      makeExercise({ name: "page_ex", question_type: "page" }),
      makeExercise({ id: 2, name: "normal" })
    ];
    const result = getExercisesWithoutReadings(exercises);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("normal");
  });

  it("sorts remaining exercises by sorting_priority ascending", () => {
    const exercises = [
      makeExercise({ id: 1, name: "third", sorting_priority: 3 }),
      makeExercise({ id: 2, name: "first", sorting_priority: 1 }),
      makeExercise({ id: 3, name: "second", sorting_priority: 2 })
    ];
    const result = getExercisesWithoutReadings(exercises);
    expect(result.map((e) => e.name)).toEqual(["first", "second", "third"]);
  });

  it("returns empty array when all exercises are readings or pages", () => {
    const exercises = [
      makeExercise({ reading_assignment: true }),
      makeExercise({ id: 2, question_type: "page" })
    ];
    expect(getExercisesWithoutReadings(exercises)).toEqual([]);
  });
});

describe("filterExercisesByQuestionType", () => {
  it("returns all nodes when selectedQuestionTypes is empty", () => {
    const nodes = [makeLeaf("q1"), makeLeaf("q2")];
    expect(filterExercisesByQuestionType(nodes, [])).toEqual(nodes);
  });

  it("filters leaf nodes to only those matching selected types", () => {
    const nodes = [
      makeLeaf("q1", { question_type: "mchoice" }),
      makeLeaf("q2", { question_type: "shortanswer" })
    ];
    const result = filterExercisesByQuestionType(nodes, ["mchoice"]);
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe("q1");
  });

  it("keeps parent nodes that have matching children", () => {
    const nodes = [
      makeParent("parent", [
        makeLeaf("child1", { question_type: "mchoice" }),
        makeLeaf("child2", { question_type: "shortanswer" })
      ])
    ];
    const result = filterExercisesByQuestionType(nodes, ["mchoice"]);
    expect(result).toHaveLength(1);
    expect(result[0].children).toHaveLength(1);
    expect(result[0].children![0].key).toBe("child1");
  });

  it("removes parent nodes when none of their children match", () => {
    const nodes = [makeParent("parent", [makeLeaf("child", { question_type: "shortanswer" })])];
    const result = filterExercisesByQuestionType(nodes, ["mchoice"]);
    expect(result).toHaveLength(0);
  });

  it("returns empty array for empty input", () => {
    expect(filterExercisesByQuestionType([], ["mchoice"])).toEqual([]);
  });
});

describe("filterOutExercisesByQuestionType", () => {
  it("removes nodes whose question_type is in the exclusion list", () => {
    const nodes = [
      makeLeaf("q1", { question_type: "mchoice" }),
      makeLeaf("q2", { question_type: "page" })
    ];
    const result = filterOutExercisesByQuestionType(nodes, ["page"]);
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe("q1");
  });

  it("removes matching children from parent nodes", () => {
    const nodes = [
      makeParent("parent", [
        makeLeaf("child1", { question_type: "mchoice" }),
        makeLeaf("child2", { question_type: "page" })
      ])
    ];
    const result = filterOutExercisesByQuestionType(nodes, ["page"]);
    expect(result[0].children).toHaveLength(1);
    expect(result[0].children![0].key).toBe("child1");
  });

  it("keeps all nodes when exclusion list is empty", () => {
    const nodes = [makeLeaf("q1"), makeLeaf("q2")];
    const result = filterOutExercisesByQuestionType(nodes, []);
    expect(result).toHaveLength(2);
  });

  it("returns empty array for empty input", () => {
    expect(filterOutExercisesByQuestionType([], ["page"])).toEqual([]);
  });
});

describe("filterExercisesByFromSource", () => {
  it("returns all nodes unchanged when fromSourceOnly is false", () => {
    const nodes = [makeLeaf("q1", { from_source: false }), makeLeaf("q2", { from_source: true })];
    const result = filterExercisesByFromSource(nodes, false);
    expect(result).toHaveLength(2);
  });

  it("returns all nodes unchanged when fromSourceOnly is omitted", () => {
    const nodes = [makeLeaf("q1"), makeLeaf("q2")];
    expect(filterExercisesByFromSource(nodes)).toHaveLength(2);
  });

  it("keeps only leaf nodes with from_source true when fromSourceOnly is true", () => {
    const nodes = [makeLeaf("q1", { from_source: true }), makeLeaf("q2", { from_source: false })];
    const result = filterExercisesByFromSource(nodes, true);
    expect(result).toHaveLength(1);
    expect(result[0].key).toBe("q1");
  });

  it("removes parent node when all children have from_source false", () => {
    const nodes = [makeParent("parent", [makeLeaf("child", { from_source: false })])];
    const result = filterExercisesByFromSource(nodes, true);
    expect(result).toHaveLength(0);
  });

  it("keeps parent node when at least one child has from_source true", () => {
    const nodes = [
      makeParent("parent", [
        makeLeaf("child1", { from_source: true }),
        makeLeaf("child2", { from_source: false })
      ])
    ];
    const result = filterExercisesByFromSource(nodes, true);
    expect(result).toHaveLength(1);
    expect(result[0].children).toHaveLength(1);
    expect(result[0].children![0].key).toBe("child1");
  });

  it("returns empty array for empty input", () => {
    expect(filterExercisesByFromSource([], true)).toEqual([]);
  });
});
