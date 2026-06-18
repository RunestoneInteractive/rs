import { Checkbox, Table } from "@mantine/core";
import classNames from "classnames";
import { ReactNode, RefCallback, useMemo, useState } from "react";

import { SelectedKey, TreeNode } from "@/types/treeNode";

import { Icon } from "./Icon";

import styles from "./TreeTable.module.css";

export interface TreeTableColumn {
  header: ReactNode;
  width?: string | number;
  render: (node: TreeNode) => ReactNode;
}

interface TreeTableProps {
  value: TreeNode[];
  columns: TreeTableColumn[];
  selectionKeys: Record<string, SelectedKey>;
  onSelect: (node: TreeNode) => void;
  onUnselect: (node: TreeNode) => void;
  header?: ReactNode;
  ariaLabel?: string;
  defaultExpandedDepth?: number;
  scrollSentinelRef?: RefCallback<HTMLElement>;
  getNodeLabel?: (node: TreeNode) => string;
}

const defaultNodeLabel = (node: TreeNode): string => node.label ?? String(node.key);

interface FlatRow {
  node: TreeNode;
  depth: number;
  hasChildren: boolean;
  expanded: boolean;
}

const collectInitiallyExpanded = (nodes: TreeNode[], depth: number, maxDepth: number): string[] => {
  if (depth > maxDepth) {
    return [];
  }
  const keys: string[] = [];

  for (const node of nodes) {
    if (node.children?.length) {
      keys.push(node.key as string);
      keys.push(...collectInitiallyExpanded(node.children, depth + 1, maxDepth));
    }
  }
  return keys;
};

export const TreeTable = ({
  value,
  columns,
  selectionKeys,
  onSelect,
  onUnselect,
  header,
  ariaLabel,
  defaultExpandedDepth = 0,
  scrollSentinelRef,
  getNodeLabel = defaultNodeLabel
}: TreeTableProps) => {
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(collectInitiallyExpanded(value, 0, defaultExpandedDepth - 1))
  );

  const toggle = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);

      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const rows = useMemo(() => {
    const flat: FlatRow[] = [];

    const walk = (nodes: TreeNode[], depth: number) => {
      for (const node of nodes) {
        const key = node.key as string;
        const hasChildren = !!node.children?.length;
        const isExpanded = expanded.has(key);

        flat.push({ node, depth, hasChildren, expanded: isExpanded });
        if (hasChildren && isExpanded) {
          walk(node.children as TreeNode[], depth + 1);
        }
      }
    };

    walk(value, 0);
    return flat;
  }, [value, expanded]);

  return (
    <div className={styles.wrap}>
      {header && <div className={styles.headerBar}>{header}</div>}
      <div className={styles.scroll}>
        {scrollSentinelRef && (
          <div ref={scrollSentinelRef} className={styles.scrollSentinel} data-scroll-sentinel="" />
        )}
        <Table highlightOnHover stickyHeader verticalSpacing="xs" aria-label={ariaLabel}>
          <Table.Thead>
            <Table.Tr>
              {columns.map((col, index) => (
                <Table.Th key={index} style={{ width: col.width }}>
                  {col.header}
                </Table.Th>
              ))}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map(({ node, depth, hasChildren, expanded: isExpanded }) => {
              const key = node.key as string;
              const selection = selectionKeys[key];
              const checked = !!selection?.checked;
              const indeterminate = !!selection?.partialChecked && !checked;
              const disabled = !!(node as TreeNode & { disabled?: boolean }).disabled;
              const nodeLabel = getNodeLabel(node);

              return (
                <Table.Tr key={key}>
                  {columns.map((col, colIndex) => {
                    if (colIndex === 0) {
                      return (
                        <Table.Td key={colIndex} className={styles.firstCellTd}>
                          <span
                            className={classNames(styles.firstCell, {
                              [styles.firstCellParent]: hasChildren
                            })}
                            data-parent={hasChildren || undefined}
                          >
                            {Array.from({ length: depth }, (_, level) => (
                              <span
                                key={level}
                                className={styles.indentGuide}
                                data-indent-guide=""
                                aria-hidden="true"
                              />
                            ))}
                            {hasChildren ? (
                              <button
                                type="button"
                                className={styles.toggle}
                                data-expanded={isExpanded || undefined}
                                onClick={() => toggle(key)}
                                aria-expanded={isExpanded}
                                aria-label={`${isExpanded ? "Collapse" : "Expand"} ${nodeLabel}`}
                              >
                                <Icon name="chevron-right" />
                              </button>
                            ) : (
                              <span className={styles.togglePlaceholder} />
                            )}
                            {!disabled && (
                              <Checkbox
                                size="sm"
                                checked={checked}
                                indeterminate={indeterminate}
                                onChange={() => (checked ? onUnselect(node) : onSelect(node))}
                                aria-label={`Select ${nodeLabel}`}
                              />
                            )}
                            {col.render(node)}
                          </span>
                        </Table.Td>
                      );
                    }
                    return <Table.Td key={colIndex}>{col.render(node)}</Table.Td>;
                  })}
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>
      </div>
    </div>
  );
};
