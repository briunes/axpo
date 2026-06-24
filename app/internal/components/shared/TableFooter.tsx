"use client";

import { Row, Text } from "@once-ui-system/core";
import { useI18n } from "../../../../src/lib/i18n-context";

export function TableFooter({ totalRows, visibleRows }: { totalRows: number; visibleRows: number }) {
  const { t } = useI18n();

  return (
    <Row fillWidth horizontal="between" vertical="center" gap="8" wrap>
      <Text className="table-caption" onBackground="neutral-weak">
        {t("common", "showingRows", { visible: visibleRows, total: totalRows })}
      </Text>
      <div className="pager-inline" aria-label={t("common", "paginationPreview")}>
        <span className="pager-pill is-active">1</span>
        <span className="pager-pill">2</span>
        <span className="pager-pill">3</span>
      </div>
    </Row>
  );
}
