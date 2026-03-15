import { Body, Container, Head, Heading, Html, Preview, Section, Text } from "@react-email/components";

export function BaseEmailTemplate(props: {
  preview: string;
  subtitle?: string;
  title: string;
}) {
  return (
    <Html>
      <Head />
      <Preview>{props.preview}</Preview>
      <Body style={{ backgroundColor: "#f5f7fb", fontFamily: "system-ui, sans-serif", padding: "24px" }}>
        <Container style={{ backgroundColor: "#ffffff", borderRadius: "16px", padding: "32px" }}>
          <Heading>{props.title}</Heading>
          {props.subtitle ? <Text>{props.subtitle}</Text> : null}
          <Section>
            <Text>
              This is a generic starter template. Replace it with your own branded transactional
              content.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
