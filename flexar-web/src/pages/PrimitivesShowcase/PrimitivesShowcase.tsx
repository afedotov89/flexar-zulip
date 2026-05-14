// Flexar Hub Web — primitives showcase page (Phase 0.6).
//
// A dev/witness page rendering every Phase 0.6 UI primitive in its
// meaningful states and variants, so the orchestrator can browser-
// verify them. Interactive primitives (form controls, tabs, overlays)
// are wired to local `useState` so they actually work when clicked.
//
// The page itself obeys the ENGINEERING_GUIDE: CSS Modules only, tokens
// only, no inline styles, named export. It doubles as a consistency
// reference for the component library.

import { useState } from "react";
import { useTheme } from "../../theme";
import { iconNames } from "../../icons";
import { Icon } from "../../components/Icon";
import { Button } from "../../components/Button";
import { IconButton } from "../../components/IconButton";
import { Divider } from "../../components/Divider";
import { Spinner } from "../../components/Spinner";
import { Skeleton } from "../../components/Skeleton";
import { Input } from "../../components/Input";
import { Textarea } from "../../components/Textarea";
import { Select } from "../../components/Select";
import { Checkbox } from "../../components/Checkbox";
import { Radio } from "../../components/Radio";
import { Toggle } from "../../components/Toggle";
import { Avatar } from "../../components/Avatar";
import { Badge } from "../../components/Badge";
import { Banner } from "../../components/Banner";
import { Tabs } from "../../components/Tabs";
import type { TabItem } from "../../components/Tabs";
import { ScrollArea } from "../../components/ScrollArea";
import { Tooltip } from "../../components/Tooltip";
import { Popover } from "../../components/Popover";
import { DropdownMenu } from "../../components/DropdownMenu";
import type { DropdownMenuEntry } from "../../components/DropdownMenu";
import { Modal } from "../../components/Modal";
import type { ButtonVariant, ButtonSize } from "../../components/Button";
import type { BannerTone } from "../../components/Banner";
import type { SpinnerSize } from "../../components/Spinner";
import type { SelectOption } from "../../components/Select";
import styles from "./PrimitivesShowcase.module.css";

const buttonVariants: ReadonlyArray<ButtonVariant> = [
  "primary",
  "secondary",
  "ghost",
  "danger",
];

const controlSizes: ReadonlyArray<ButtonSize> = ["sm", "md", "lg"];

const spinnerSizes: ReadonlyArray<SpinnerSize> = ["sm", "md", "lg"];

const bannerTones: ReadonlyArray<BannerTone> = [
  "info",
  "success",
  "warning",
  "danger",
];

const selectOptions: ReadonlyArray<SelectOption> = [
  { value: "alpha", label: "Alpha" },
  { value: "beta", label: "Beta" },
  { value: "gamma", label: "Gamma (disabled)", disabled: true },
];

const tabItems: ReadonlyArray<TabItem> = [
  { id: "overview", label: "Overview" },
  { id: "activity", label: "Activity" },
  { id: "settings", label: "Settings" },
  { id: "archived", label: "Archived", disabled: true },
];

export function PrimitivesShowcase(): React.JSX.Element {
  const { theme, toggleTheme } = useTheme();

  // Interactive form-control state.
  const [textValue, setTextValue] = useState("");
  const [invalidValue, setInvalidValue] = useState("not-an-email");
  const [textareaValue, setTextareaValue] = useState("");
  const [selectValue, setSelectValue] = useState("");
  const [checkboxChecked, setCheckboxChecked] = useState(true);
  const [radioValue, setRadioValue] = useState("standard");
  const [toggleChecked, setToggleChecked] = useState(true);

  // Tabs state.
  const [activeTab, setActiveTab] = useState<string>("overview");

  // Overlay state.
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [lastMenuAction, setLastMenuAction] = useState("none yet");

  const menuItems: DropdownMenuEntry[] = [
    {
      id: "rename",
      label: "Rename",
      icon: "hash",
      onSelect: () => setLastMenuAction("rename"),
    },
    {
      id: "mute",
      label: "Mute notifications",
      icon: "bell",
      onSelect: () => setLastMenuAction("mute"),
    },
    { id: "sep-1", separator: true },
    {
      id: "delete",
      label: "Delete",
      icon: "close",
      danger: true,
      onSelect: () => setLastMenuAction("delete"),
    },
    {
      id: "locked",
      label: "Locked action",
      icon: "lock",
      disabled: true,
      onSelect: () => setLastMenuAction("locked"),
    },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <div className={styles.headerText}>
            <h1 className={styles.title}>Flexar Hub — UI Primitives</h1>
            <p className={styles.subtitle}>
              Phase 0.6 primitive library. Active theme: {theme}.
            </p>
          </div>
          <Button variant="secondary" onClick={toggleTheme}>
            Toggle theme
          </Button>
        </header>

        {/* ---- Button ---- */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Button</h2>
          {controlSizes.map((size) => (
            <div key={size} className={styles.group}>
              <span className={styles.subheading}>size: {size}</span>
              <div className={styles.row}>
                {buttonVariants.map((variant) => (
                  <Button key={variant} variant={variant} size={size}>
                    {variant}
                  </Button>
                ))}
              </div>
            </div>
          ))}
          <div className={styles.group}>
            <span className={styles.subheading}>
              icons, disabled, loading, full width
            </span>
            <div className={styles.row}>
              <Button iconLeft="plus">With left icon</Button>
              <Button iconRight="chevron-right" variant="secondary">
                With right icon
              </Button>
              <Button disabled>Disabled</Button>
              <Button loading>Loading</Button>
            </div>
            <Button fullWidth iconLeft="check">
              Full width
            </Button>
          </div>
        </section>

        {/* ---- IconButton ---- */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>IconButton</h2>
          {controlSizes.map((size) => (
            <div key={size} className={styles.group}>
              <span className={styles.subheading}>size: {size}</span>
              <div className={styles.row}>
                {buttonVariants.map((variant) => (
                  <IconButton
                    key={variant}
                    icon="dots-vertical"
                    aria-label={`${variant} actions`}
                    variant={variant}
                    size={size}
                  />
                ))}
              </div>
            </div>
          ))}
          <div className={styles.group}>
            <span className={styles.subheading}>disabled, loading</span>
            <div className={styles.row}>
              <IconButton icon="bell" aria-label="Notifications" disabled />
              <IconButton icon="search" aria-label="Search" loading />
            </div>
          </div>
        </section>

        {/* ---- Icon ---- */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Icon</h2>
          <div className={styles.iconGrid}>
            {iconNames.map((name) => (
              <div key={name} className={styles.iconCell}>
                <Icon name={name} size="lg" aria-label={name} />
                <span className={styles.iconCellName}>{name}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ---- Spinner ---- */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Spinner</h2>
          <div className={styles.row}>
            {spinnerSizes.map((size) => (
              <Spinner key={size} size={size} aria-label={`Loading (${size})`} />
            ))}
          </div>
        </section>

        {/* ---- Skeleton ---- */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Skeleton</h2>
          <div className={styles.group}>
            <span className={styles.subheading}>text</span>
            <div className={styles.stack}>
              <Skeleton variant="text" height="sm" />
              <Skeleton variant="text" height="md" width="lg" />
              <Skeleton variant="text" height="lg" width="md" />
            </div>
          </div>
          <div className={styles.group}>
            <span className={styles.subheading}>rect</span>
            <div className={styles.row}>
              <Skeleton variant="rect" width="sm" height="md" />
              <Skeleton variant="rect" width="md" height="lg" />
            </div>
          </div>
          <div className={styles.group}>
            <span className={styles.subheading}>circle</span>
            <div className={styles.row}>
              <Skeleton variant="circle" height="sm" />
              <Skeleton variant="circle" height="md" />
              <Skeleton variant="circle" height="lg" />
            </div>
          </div>
        </section>

        {/* ---- Divider ---- */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Divider</h2>
          <div className={styles.group}>
            <span className={styles.subheading}>horizontal</span>
            <Divider />
          </div>
          <div className={styles.group}>
            <span className={styles.subheading}>vertical</span>
            <div className={styles.dividerRow}>
              <span className={styles.popoverText}>Left</span>
              <Divider orientation="vertical" spacing="md" />
              <span className={styles.popoverText}>Right</span>
            </div>
          </div>
        </section>

        {/* ---- Input ---- */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Input</h2>
          <div className={styles.formGrid}>
            {controlSizes.map((size) => (
              <div key={size} className={styles.formRow}>
                <label className={styles.fieldLabel}>size: {size}</label>
                <Input
                  size={size}
                  placeholder={`Type here (${size})`}
                  value={textValue}
                  onChange={(event) => setTextValue(event.target.value)}
                />
              </div>
            ))}
            <div className={styles.formRow}>
              <label className={styles.fieldLabel}>with icons</label>
              <Input
                iconLeft="search"
                iconRight="close"
                placeholder="Search"
                value={textValue}
                onChange={(event) => setTextValue(event.target.value)}
              />
            </div>
            <div className={styles.formRow}>
              <label className={styles.fieldLabel}>disabled</label>
              <Input disabled placeholder="Disabled" />
            </div>
            <div className={styles.formRow}>
              <label className={styles.fieldLabel}>invalid</label>
              <Input
                invalid
                value={invalidValue}
                onChange={(event) => setInvalidValue(event.target.value)}
              />
            </div>
          </div>
        </section>

        {/* ---- Textarea ---- */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Textarea</h2>
          <div className={styles.formGrid}>
            <div className={styles.formRow}>
              <label className={styles.fieldLabel}>default</label>
              <Textarea
                placeholder="Write a message…"
                value={textareaValue}
                onChange={(event) => setTextareaValue(event.target.value)}
              />
            </div>
            <div className={styles.formRow}>
              <label className={styles.fieldLabel}>disabled</label>
              <Textarea disabled placeholder="Disabled" />
            </div>
            <div className={styles.formRow}>
              <label className={styles.fieldLabel}>invalid</label>
              <Textarea invalid defaultValue="Something went wrong here" />
            </div>
          </div>
        </section>

        {/* ---- Select ---- */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Select</h2>
          <div className={styles.formGrid}>
            {controlSizes.map((size) => (
              <div key={size} className={styles.formRow}>
                <label className={styles.fieldLabel}>size: {size}</label>
                <Select
                  size={size}
                  options={[...selectOptions]}
                  placeholder="Choose one"
                  value={selectValue}
                  onChange={(event) => setSelectValue(event.target.value)}
                />
              </div>
            ))}
            <div className={styles.formRow}>
              <label className={styles.fieldLabel}>disabled</label>
              <Select disabled options={[...selectOptions]} placeholder="Disabled" />
            </div>
            <div className={styles.formRow}>
              <label className={styles.fieldLabel}>invalid</label>
              <Select
                invalid
                options={[...selectOptions]}
                placeholder="Pick a value"
                value={selectValue}
                onChange={(event) => setSelectValue(event.target.value)}
              />
            </div>
          </div>
        </section>

        {/* ---- Checkbox ---- */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Checkbox</h2>
          <div className={styles.stack}>
            <Checkbox
              label="Interactive checkbox"
              checked={checkboxChecked}
              onChange={(event) => setCheckboxChecked(event.target.checked)}
            />
            <Checkbox label="Indeterminate" indeterminate />
            <Checkbox label="Disabled unchecked" disabled />
            <Checkbox label="Disabled checked" disabled checked readOnly />
            <Checkbox label="Invalid" invalid />
          </div>
        </section>

        {/* ---- Radio ---- */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Radio</h2>
          <div className={styles.stack}>
            <Radio
              label="Standard"
              name="showcase-plan"
              value="standard"
              checked={radioValue === "standard"}
              onChange={(event) => setRadioValue(event.target.value)}
            />
            <Radio
              label="Pro"
              name="showcase-plan"
              value="pro"
              checked={radioValue === "pro"}
              onChange={(event) => setRadioValue(event.target.value)}
            />
            <Radio
              label="Disabled option"
              name="showcase-plan"
              value="disabled"
              disabled
            />
            <Radio
              label="Invalid option"
              name="showcase-plan-invalid"
              value="invalid"
              invalid
            />
          </div>
        </section>

        {/* ---- Toggle ---- */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Toggle</h2>
          <div className={styles.stack}>
            <Toggle
              label="Interactive (md)"
              checked={toggleChecked}
              onChange={(event) => setToggleChecked(event.target.checked)}
            />
            <Toggle
              label="Interactive (sm)"
              size="sm"
              checked={toggleChecked}
              onChange={(event) => setToggleChecked(event.target.checked)}
            />
            <Toggle label="Disabled off" disabled />
            <Toggle label="Disabled on" disabled checked readOnly />
          </div>
        </section>

        {/* ---- Avatar ---- */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Avatar</h2>
          <div className={styles.group}>
            <span className={styles.subheading}>with image</span>
            <div className={styles.row}>
              {controlSizes.map((size) => (
                <Avatar
                  key={size}
                  size={size}
                  name="Ada Lovelace"
                  src="https://i.pravatar.cc/96?img=47"
                />
              ))}
            </div>
          </div>
          <div className={styles.group}>
            <span className={styles.subheading}>initials fallback</span>
            <div className={styles.row}>
              {controlSizes.map((size) => (
                <Avatar key={size} size={size} name="Grace Hopper" />
              ))}
            </div>
          </div>
        </section>

        {/* ---- Badge ---- */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Badge</h2>
          <div className={styles.row}>
            <Badge variant="neutral">neutral</Badge>
            <Badge variant="accent">accent</Badge>
            <Badge variant="danger">danger</Badge>
            <Badge variant="accent" count={7} />
            <Badge variant="danger" count={150} max={99} />
          </div>
        </section>

        {/* ---- Banner ---- */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Banner</h2>
          <div className={styles.stack}>
            {bannerTones.map((tone) => (
              <Banner
                key={tone}
                tone={tone}
                title={`${tone} banner`}
              >
                This is an inline {tone} message demonstrating the banner.
              </Banner>
            ))}
            {!bannerDismissed && (
              <Banner
                tone="info"
                title="Dismissible banner"
                onDismiss={() => setBannerDismissed(true)}
              >
                Click the X to dismiss this banner.
              </Banner>
            )}
            {bannerDismissed && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setBannerDismissed(false)}
              >
                Restore dismissed banner
              </Button>
            )}
          </div>
        </section>

        {/* ---- Tabs ---- */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Tabs</h2>
          <Tabs
            tabs={[...tabItems]}
            activeId={activeTab}
            onChange={setActiveTab}
            aria-label="Showcase tabs"
          >
            {(active) => (
              <span className={styles.popoverText}>
                Active panel: {active}
              </span>
            )}
          </Tabs>
        </section>

        {/* ---- ScrollArea ---- */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>ScrollArea</h2>
          <div className={styles.group}>
            <span className={styles.subheading}>vertical</span>
            <ScrollArea className={`${styles.card} ${styles.scrollBox}`}>
              <div className={styles.scrollTallContent}>
                {Array.from({ length: 12 }, (_, index) => (
                  <span key={index} className={styles.popoverText}>
                    Scrollable row {index + 1}
                  </span>
                ))}
              </div>
            </ScrollArea>
          </div>
          <div className={styles.group}>
            <span className={styles.subheading}>horizontal</span>
            <ScrollArea
              orientation="horizontal"
              className={`${styles.card} ${styles.scrollBox}`}
            >
              <div className={styles.scrollWideContent}>
                <span className={styles.popoverText}>
                  This content is wider than its container, so it scrolls
                  horizontally — drag the scrollbar or use the arrow keys.
                </span>
              </div>
            </ScrollArea>
          </div>
        </section>

        {/* ---- Tooltip ---- */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Tooltip</h2>
          <div className={styles.row}>
            <Tooltip content="Tooltip on top">
              <Button variant="secondary">Hover or focus me</Button>
            </Tooltip>
            <Tooltip content="Appears to the right" placement="right">
              <IconButton icon="bell" aria-label="Notifications" />
            </Tooltip>
          </div>
        </section>

        {/* ---- Popover ---- */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Popover</h2>
          <div className={styles.row}>
            <Popover
              open={popoverOpen}
              onOpenChange={setPopoverOpen}
              aria-label="Showcase popover"
              trigger={<Button>Toggle popover</Button>}
            >
              <div className={styles.popoverBody}>
                <span className={styles.popoverText}>
                  A click-triggered floating panel.
                </span>
                <Button size="sm" onClick={() => setPopoverOpen(false)}>
                  Close
                </Button>
              </div>
            </Popover>
          </div>
        </section>

        {/* ---- DropdownMenu ---- */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>DropdownMenu</h2>
          <div className={styles.row}>
            <DropdownMenu
              trigger={
                <Button iconRight="chevron-down">Open menu</Button>
              }
              items={menuItems}
              aria-label="Showcase actions"
            />
            <span className={styles.popoverText}>
              Last action: {lastMenuAction}
            </span>
          </div>
        </section>

        {/* ---- Modal ---- */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Modal</h2>
          <div className={styles.row}>
            <Button onClick={() => setModalOpen(true)}>Open modal</Button>
          </div>
          <Modal
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            title="Showcase modal"
            footer={
              <>
                <Button
                  variant="ghost"
                  onClick={() => setModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button onClick={() => setModalOpen(false)}>Confirm</Button>
              </>
            }
          >
            <span className={styles.popoverText}>
              A centered dialog with a backdrop, focus trap and body-scroll
              lock. Press Escape or click the backdrop to dismiss.
            </span>
          </Modal>
        </section>
      </div>
    </div>
  );
}
