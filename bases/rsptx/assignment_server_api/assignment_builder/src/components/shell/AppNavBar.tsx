import { Button, Menu } from "@mantine/core";
import { Fragment } from "react";

import { Icon } from "@components/ui/Icon";

import { isNavItemActive, NavItem } from "@/navUtils";

import styles from "./AppNavBar.module.css";

interface AppNavBarProps {
  items: NavItem[];
  activePath?: string;
  scrolled?: boolean;
}

const menuTransitionProps = { transition: "pop", duration: 180 } as const;

const renderSubItem = (item: NavItem, index: number) => {
  if (item.separator) {
    return <Menu.Divider key={`divider-${index}`} />;
  }

  const leftSection = item.icon ? <Icon name={item.icon} /> : undefined;

  return (
    <Menu.Item
      key={item.label ?? index}
      leftSection={leftSection}
      disabled={!item.command}
      onClick={item.command}
    >
      {item.label}
    </Menu.Item>
  );
};

const renderTopItem = (item: NavItem, index: number, activePath: string) => {
  const leftSection = item.icon ? <Icon name={item.icon} /> : undefined;

  if (item.items?.length) {
    const visibleSubItems = item.items.filter((sub) => sub.visible !== false);

    return (
      <Menu
        key={item.label ?? index}
        position="bottom-start"
        withinPortal
        transitionProps={menuTransitionProps}
      >
        <Menu.Target>
          <Button
            variant="subtle"
            color="gray"
            size="sm"
            className={styles.navButton}
            leftSection={leftSection}
            rightSection={<Icon name="chevron-down" />}
            title={item.label}
          >
            {item.label}
          </Button>
        </Menu.Target>
        <Menu.Dropdown>{visibleSubItems.map(renderSubItem)}</Menu.Dropdown>
      </Menu>
    );
  }

  const active = isNavItemActive(item, activePath);

  return (
    <Button
      key={item.label ?? index}
      variant="subtle"
      color="gray"
      size="sm"
      className={styles.navButton}
      data-active={active || undefined}
      aria-current={active ? "page" : undefined}
      leftSection={leftSection}
      onClick={item.command}
      title={item.label}
    >
      {item.label}
    </Button>
  );
};

const renderCompactItem = (item: NavItem, index: number, activePath: string) => {
  if (item.items?.length) {
    const visibleSubItems = item.items.filter((sub) => sub.visible !== false);

    return (
      <Fragment key={item.label ?? index}>
        <Menu.Label>{item.label}</Menu.Label>
        {visibleSubItems.map(renderSubItem)}
      </Fragment>
    );
  }

  const leftSection = item.icon ? <Icon name={item.icon} /> : undefined;
  const active = isNavItemActive(item, activePath);

  return (
    <Menu.Item
      key={item.label ?? index}
      className={active ? styles.menuItemActive : undefined}
      leftSection={leftSection}
      disabled={!item.command}
      onClick={item.command}
      aria-current={active ? "page" : undefined}
    >
      {item.label}
    </Menu.Item>
  );
};

export const AppNavBar = ({ items, activePath = "", scrolled = false }: AppNavBarProps) => {
  const visibleItems = items.filter((item) => item.visible !== false);

  return (
    <nav className={styles.bar} data-scrolled={scrolled || undefined} aria-label="Main navigation">
      <span className={styles.brand}>
        <img
          className={styles.brandImage}
          src="/staticAssets/RAIcon.png"
          alt=""
          aria-hidden="true"
        />
        <span className={styles.wordmark}>Runestone</span>
      </span>
      <div className={styles.items}>
        {visibleItems.map((item, index) => renderTopItem(item, index, activePath))}
      </div>
      <div className={styles.compact}>
        <Menu position="bottom-end" withinPortal transitionProps={menuTransitionProps}>
          <Menu.Target>
            <Button
              variant="subtle"
              color="gray"
              size="sm"
              className={styles.navButton}
              aria-label="Open navigation menu"
              leftSection={<Icon name="menu" />}
            >
              Menu
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            {visibleItems.map((item, index) => renderCompactItem(item, index, activePath))}
          </Menu.Dropdown>
        </Menu>
      </div>
    </nav>
  );
};
