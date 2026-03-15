import type { PropsWithChildren } from "react";
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

type EmailLayoutProps = PropsWithChildren<{
  preview: string;
  title: string;
}>;

export function EmailLayout({ children, preview, title }: EmailLayoutProps) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: "#f5f5f5", fontFamily: "Inter, sans-serif" }}>
        <Container style={{ backgroundColor: "#ffffff", margin: "40px auto", padding: "32px" }}>
          <Heading>{title}</Heading>
          <Section>{children}</Section>
          <Text style={{ color: "#666666", fontSize: "12px", marginTop: "32px" }}>
            Sent from {{projectTitle}}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
