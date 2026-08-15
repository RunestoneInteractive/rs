import { SearchInput } from "@components/ui/SearchInput";
import { TreeTable, TreeTableColumn } from "@components/ui/TreeTable";
import { Badge, Button, Group, Modal, Stack, Switch, Text, Tooltip } from "@mantine/core";
import {
  useImportAssignmentMutation,
  useImportCourseAssignmentsMutation,
  useShareableTreeQuery
} from "@store/assignment/assignment.logic.api";
import debounce from "lodash/debounce";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  ShareableTreeAssignment,
  ShareableTreeCourse
} from "@/types/assignmentSharing";
import { SelectedKey, TreeNode } from "@/types/treeNode";

import { ImportPreviewPanel } from "./ImportPreviewPanel";

import styles from "./ImportAssignmentModal.module.css";

const SEARCH_DEBOUNCE_MS = 300;
const PAGE_SIZE = 25;

interface ImportAssignmentModalProps {
  visible: boolean;
  onHide: () => void;
}

/** Node keys are namespaced so a course and an assignment can share an id. */
const courseKey = (course: ShareableTreeCourse) => `course:${course.id}`;
const assignmentKey = (assignment: ShareableTreeAssignment) => `assignment:${assignment.id}`;

export const buildTree = (courses: ShareableTreeCourse[]): TreeNode[] =>
  courses.map((course) => ({
    key: courseKey(course),
    label: course.course_name,
    data: course,
    children: course.assignments.map((assignment) => ({
      key: assignmentKey(assignment),
      label: assignment.name,
      data: assignment
    }))
  }));

/**
 * Roll a set of checked assignment ids up into TreeTable's selection map.
 *
 * A course is checked when every assignment under it is, and partially checked
 * when only some are -- the same contract `getSelectedKeys` provides for the
 * exercise picker, which is what makes the two trees behave alike.
 */
export const buildSelectionKeys = (
  courses: ShareableTreeCourse[],
  selectedIds: Set<number>
): Record<string, SelectedKey> => {
  const keys: Record<string, SelectedKey> = {};

  for (const course of courses) {
    let checkedCount = 0;

    for (const assignment of course.assignments) {
      const checked = selectedIds.has(assignment.id);

      keys[assignmentKey(assignment)] = { checked, partialChecked: false };
      if (checked) {
        checkedCount += 1;
      }
    }

    const total = course.assignments.length;

    keys[courseKey(course)] = {
      checked: total > 0 && checkedCount === total,
      partialChecked: checkedCount > 0 && checkedCount < total
    };
  }
  return keys;
};

const isCourseNode = (node: TreeNode) => String(node.key).startsWith("course:");

const assignmentsUnder = (node: TreeNode): ShareableTreeAssignment[] =>
  isCourseNode(node)
    ? (node.data as ShareableTreeCourse).assignments
    : [node.data as ShareableTreeAssignment];

/**
 * Browse and import assignments other courses share.
 *
 * A tree of courses rather than a flat list of assignments: the question an
 * instructor arrives with is "what does that course use", and taking a whole
 * course at once is the common case. Checking a course takes all of it;
 * expanding one lets you take part. The shape deliberately matches the exercise
 * picker, down to the shared TreeTable.
 */
export const ImportAssignmentModal = ({ visible, onHide }: ImportAssignmentModalProps) => {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [useBaseCourse, setUseBaseCourse] = useState(false);
  const [onlyMyCourses, setOnlyMyCourses] = useState(false);
  const [page, setPage] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [previewId, setPreviewId] = useState<number | null>(null);

  const { data, isFetching } = useShareableTreeQuery(
    {
      search: debouncedSearch,
      use_base_course: useBaseCourse,
      only_my_courses: onlyMyCourses,
      page,
      limit: PAGE_SIZE
    },
    // The modal stays mounted so it can animate; don't search until it opens.
    { skip: !visible }
  );

  const [importAssignment, { isLoading: isImportingOne }] = useImportAssignmentMutation();
  const [importCourse, { isLoading: isImportingCourse }] = useImportCourseAssignmentsMutation();

  const courses = useMemo(() => data?.courses ?? [], [data]);
  const tree = useMemo(() => buildTree(courses), [courses]);
  const selectionKeys = useMemo(
    () => buildSelectionKeys(courses, selectedIds),
    [courses, selectedIds]
  );

  const debouncedSetSearch = useRef(
    debounce((value: string) => {
      setDebouncedSearch(value);
      setPage(0);
    }, SEARCH_DEBOUNCE_MS)
  ).current;

  useEffect(() => () => debouncedSetSearch.cancel(), [debouncedSetSearch]);

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearch(value);
      debouncedSetSearch(value);
    },
    [debouncedSetSearch]
  );

  const handleClose = useCallback(() => {
    setSelectedIds(new Set());
    setPreviewId(null);
    onHide();
  }, [onHide]);

  // Only ever selects what can actually be taken. An assignment already in the
  // course would be skipped by the import anyway, so checking it would promise
  // something the count then contradicts.
  const selectableUnder = useCallback(
    (node: TreeNode) => assignmentsUnder(node).filter((a) => !a.already_imported),
    []
  );

  const handleSelect = useCallback(
    (node: TreeNode) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);

        for (const assignment of selectableUnder(node)) {
          next.add(assignment.id);
        }
        return next;
      });
    },
    [selectableUnder]
  );

  const handleUnselect = useCallback(
    (node: TreeNode) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);

        for (const assignment of assignmentsUnder(node)) {
          next.delete(assignment.id);
        }
        return next;
      });
    },
    []
  );

  /**
   * Import the selection, one course at a time where a whole course is checked.
   *
   * A fully checked course goes through the bulk endpoint rather than N single
   * imports: it is one request, and it picks up anything added to that course
   * since the tree was loaded.
   */
  const handleImport = useCallback(async () => {
    const wholeCourses = courses.filter(
      (course) =>
        course.assignments.length > 0 &&
        course.assignments.every(
          (a) => a.already_imported || selectedIds.has(a.id)
        ) &&
        course.assignments.some((a) => selectedIds.has(a.id))
    );
    const wholeCourseIds = new Set(wholeCourses.map((c) => c.id));
    const individual = courses
      .filter((course) => !wholeCourseIds.has(course.id))
      .flatMap((course) => course.assignments)
      .filter((a) => selectedIds.has(a.id));

    let failed = false;

    for (const course of wholeCourses) {
      const result = await importCourse(course.id)
        .unwrap()
        .catch(() => null);

      failed = failed || !result;
    }
    for (const assignment of individual) {
      const result = await importAssignment(assignment.id)
        .unwrap()
        .catch(() => null);

      failed = failed || !result;
    }

    if (!failed) {
      handleClose();
    } else {
      // Something landed even if something else did not, so drop the selection
      // rather than inviting a retry that would duplicate the successful half.
      setSelectedIds(new Set());
    }
  }, [courses, selectedIds, importCourse, importAssignment, handleClose]);

  const columns = useMemo<TreeTableColumn[]>(
    () => [
      {
        header: "Course / assignment",
        render: (node) => {
          if (isCourseNode(node)) {
            const course = node.data as ShareableTreeCourse;

            return (
              <Group gap="xs" wrap="nowrap">
                <Text size="sm" fw={500}>
                  {course.course_name}
                </Text>
                {course.is_official ? (
                  <Tooltip label={`Comes with ${course.book_title}`} position="top">
                    <Badge size="sm" variant="filled">
                      Official
                    </Badge>
                  </Tooltip>
                ) : null}
                {course.is_mine ? (
                  <Badge size="sm" variant="light" color="gray">
                    Yours
                  </Badge>
                ) : null}
              </Group>
            );
          }

          const assignment = node.data as ShareableTreeAssignment;

          return (
            <Group gap="xs" wrap="nowrap">
              <Text size="sm" c={assignment.already_imported ? "dimmed" : undefined}>
                {assignment.name}
              </Text>
              {assignment.already_imported ? (
                <Tooltip
                  label={
                    assignment.imported_as
                      ? `Already in this course as “${assignment.imported_as}”`
                      : "Already in this course"
                  }
                  position="top"
                >
                  <Badge size="sm" variant="light" color="green">
                    Imported
                  </Badge>
                </Tooltip>
              ) : null}
            </Group>
          );
        }
      },
      {
        header: "Book",
        width: "18rem",
        render: (node) =>
          isCourseNode(node) ? (
            <Stack gap={0}>
              <Text size="xs" c="dimmed">
                {(node.data as ShareableTreeCourse).book_title}
              </Text>
              {(node.data as ShareableTreeCourse).institution ? (
                <Text size="xs" c="dimmed">
                  {(node.data as ShareableTreeCourse).institution}
                </Text>
              ) : null}
            </Stack>
          ) : null
      },
      {
        header: "Questions",
        width: "7rem",
        render: (node) => (
          <Text size="xs" c="dimmed">
            {isCourseNode(node)
              ? `${(node.data as ShareableTreeCourse).shareable_count} assignment${
                  (node.data as ShareableTreeCourse).shareable_count === 1 ? "" : "s"
                }`
              : `${(node.data as ShareableTreeAssignment).question_count} question${
                  (node.data as ShareableTreeAssignment).question_count === 1 ? "" : "s"
                }`}
          </Text>
        )
      },
      {
        header: "",
        width: "6rem",
        // A real button so the question list stays reachable from the keyboard;
        // the row itself has no click handler in this tree.
        render: (node) =>
          isCourseNode(node) ? null : (
            <button
              type="button"
              className={styles.nameButton}
              onClick={() => setPreviewId((node.data as ShareableTreeAssignment).id)}
            >
              Preview
            </button>
          )
      }
    ],
    []
  );

  const selectedCount = selectedIds.size;
  const isImporting = isImportingOne || isImportingCourse;
  const totalPages = data?.pagination.pages ?? 0;

  return (
    <Modal
      opened={visible}
      onClose={handleClose}
      title="Import assignments"
      size="72rem"
    >
      <Stack gap="md">
        <Group justify="space-between" align="center">
          <SearchInput
            value={search}
            onChange={handleSearchChange}
            placeholder="Search courses, institutions and books"
            ariaLabel="Search courses"
            className={styles.search}
          />
          <Group gap="lg" wrap="nowrap">
            <Switch
              label="Only for this book"
              checked={useBaseCourse}
              onChange={(e) => {
                setUseBaseCourse(e.currentTarget.checked);
                setPage(0);
              }}
            />
            <Switch
              label="Only courses I teach"
              checked={onlyMyCourses}
              onChange={(e) => {
                setOnlyMyCourses(e.currentTarget.checked);
                setPage(0);
              }}
            />
          </Group>
        </Group>

        {isFetching && !courses.length ? (
          <Text size="sm" c="dimmed">
            Loading courses…
          </Text>
        ) : courses.length ? (
          <TreeTable
            value={tree}
            columns={columns}
            selectionKeys={selectionKeys}
            onSelect={handleSelect}
            onUnselect={handleUnselect}
            ariaLabel="Courses sharing assignments"
          />
        ) : (
          <Text size="sm" c="dimmed">
            No courses match your search.
          </Text>
        )}

        {totalPages > 1 ? (
          <Group justify="center" gap="sm">
            <Button
              variant="default"
              size="xs"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(p - 1, 0))}
            >
              Previous
            </Button>
            <Text size="xs" c="dimmed">
              Page {page + 1} of {totalPages}
            </Text>
            <Button
              variant="default"
              size="xs"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </Group>
        ) : null}

        <Text size="xs" c="dimmed">
          Checking a course takes everything it offers. Imports start hidden, exercises are used
          where they live rather than copied into your book, and anything you already have is
          skipped.
        </Text>

        <Group justify="flex-end">
          <Button variant="default" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleImport} loading={isImporting} disabled={selectedCount === 0}>
            {selectedCount === 0
              ? "Import"
              : `Import ${selectedCount} assignment${selectedCount === 1 ? "" : "s"}`}
          </Button>
        </Group>
      </Stack>

      <ImportPreviewPanel assignmentId={previewId} onClose={() => setPreviewId(null)} />
    </Modal>
  );
};
