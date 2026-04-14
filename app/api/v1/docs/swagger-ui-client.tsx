"use client";

import SwaggerUI from "swagger-ui-react";
import "swagger-ui-react/swagger-ui.css";

interface Props {
  specUrl: string;
}

export default function SwaggerUIClient({ specUrl }: Props) {
  return <SwaggerUI url={specUrl} />;
}
