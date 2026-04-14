"use client";

import { Input, Row, Text } from "@once-ui-system/core";

export function SectionToolbar({
  searchValue,
  onSearchChange,
  totalRows,
  visibleRows,
  searchPlaceholder,
}: {
  searchValue: string;
  onSearchChange: (value: string) => void;
  totalRows: number;
  visibleRows: number;
  searchPlaceholder: string;
}) {
  return (
    <Row fillWidth horizontal="between" vertical="center" gap="8" wrap>
      <div className="toolbar-meta">
        <Text variant="label-default-s" onBackground="neutral-weak">Rows</Text>
        <Text variant="label-default-s">{visibleRows}/{totalRows}</Text>
      </div>
      <Input
        id="section-search"
        label=""
        value={searchValue}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder={searchPlaceholder}
      />
    </Row>
  );
}
