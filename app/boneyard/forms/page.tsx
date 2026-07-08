"use client";

import { BoneyardFormSkeletonProbe } from "../../internal/components/shared";

export default function BoneyardFormsPage() {
  return (
    <>
      <BoneyardFormSkeletonProbe name="new-user-form" shape="user" tabs={3} />
      <BoneyardFormSkeletonProbe name="new-agency-form" shape="agency" />
      <BoneyardFormSkeletonProbe name="new-client-form" shape="client" />
      <BoneyardFormSkeletonProbe name="new-base-values-form" shape="base-values" />
      <BoneyardFormSkeletonProbe name="new-simulation-form" shape="simulation-edit" />
    </>
  );
}
