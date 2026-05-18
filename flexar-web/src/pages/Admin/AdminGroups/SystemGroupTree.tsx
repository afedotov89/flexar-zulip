// System-roles tree section for the admin groups list (Variant C).
//
// Renders the realm's system groups as a collapsible tree, so admins
// can see Zulip's role hierarchy at a glance — e.g. that
// `role:administrators` inherits from `role:owners`, and `role:internet`
// from `role:everyone`. The flat list below this section continues to
// show only custom groups, which are the everyday management surface;
// pinning system groups in a foldable tree keeps the daily list short
// without losing visibility of the inheritance shape.
//
// Collapsed by default so the page doesn't expand into a 7-deep
// waterfall on first paint; admins click "Системные роли" to unfold.

import { useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../../../components/Icon";
import type { UserGroup } from "../../../domain";
import {
  buildGroupTree,
  computeTransitiveMembers,
  type TreeNode,
} from "../../../lib/userGroups";
import styles from "./SystemGroupTree.module.css";

export interface SystemGroupTreeProps {
  /**
   * Only the system groups. Caller filters from the realm directory.
   * Sort order: caller-provided (we preserve it for both roots and
   * children).
   */
  systemGroups: ReadonlyArray<UserGroup>;
  /**
   * Full realm directory — needed to compute the transitive member
   * count, since a node's `members.length` is direct-only and would
   * under-count for inheriting groups (admins / moderators / …).
   */
  directory: Readonly<Record<number, UserGroup>>;
}

export function SystemGroupTree({
  systemGroups,
  directory,
}: SystemGroupTreeProps): React.JSX.Element | null {
  const [expanded, setExpanded] = useState(false);

  if (systemGroups.length === 0) {
    return null;
  }

  const roots = buildGroupTree(systemGroups);

  return (
    <section className={styles.section}>
      <button
        type="button"
        className={styles.toggle}
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
      >
        <Icon
          name="chevron-right"
          size="sm"
          className={`${styles.toggleChevron}${
            expanded ? ` ${styles.toggleChevronExpanded}` : ""
          }`}
        />
        Системные роли
        <span className={styles.toggleCount}>{systemGroups.length}</span>
      </button>

      {expanded && (
        <ul className={styles.tree} aria-label="Дерево системных ролей">
          {roots.map((node) => (
            <TreeRow
              key={node.group.id}
              node={node}
              directory={directory}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

interface TreeRowProps {
  node: TreeNode;
  directory: Readonly<Record<number, UserGroup>>;
}

function TreeRow({ node, directory }: TreeRowProps): React.JSX.Element {
  const { group, children } = node;
  const memberCount = computeTransitiveMembers(group.id, directory).size;
  return (
    <li className={styles.node}>
      <Link
        to={`/admin/groups/${group.id}`}
        className={styles.row}
        title="Открыть для просмотра"
      >
        <span className={styles.rowMain}>
          <span className={styles.rowName}>{group.name}</span>
          {group.description !== "" && (
            <span className={styles.rowDescription}>{group.description}</span>
          )}
        </span>
        <span className={styles.rowMeta}>
          <span className={styles.memberCount}>{memberCount} чел.</span>
          <Icon
            name="chevron-right"
            size="sm"
            className={styles.rowChevron}
          />
        </span>
      </Link>
      {children.length > 0 && (
        <ul className={styles.children}>
          {children.map((child) => (
            <TreeRow
              key={child.group.id}
              node={child}
              directory={directory}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
