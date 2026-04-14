"use client";

import { Row, Text } from "@once-ui-system/core";

export function TableFooter({ totalRows, visibleRows }: { totalRows: number; visibleRows: number }) {
  return (
    <Row fillWidth horizontal="between" vertical="center" gap="8" wrap>
      <Text className="table-caption" onBackground="neutral-weak">
        Showing {visibleRows} of {totalRows} rows
      </Text>
      <div className="pager-inline" aria-label="Pagination preview">
        <span className="pager-pill is-active">1</span>
        <span className="pager-pill">2</span>
        <span className="pager-pill">3</span>
      </div>
    </Row>
  );
}
