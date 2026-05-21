import { Container } from "@/components/layout/container"
import { Stack } from "@/components/layout/stack"
import { Heading } from "@/components/typography/heading"
import { Text } from "@/components/typography/text"

export const metadata = {
  title: "Terms & Conditions",
}

export default function TermsPage() {
  return (
    <div className="flex flex-1 flex-col bg-background">
      <Container size="narrow" className="py-section">
        <Stack gap="section">
          <Stack gap="stack">
            <Heading variant="title" as="h1">
              Terms &amp; Conditions
            </Heading>
            <Text variant="muted">Last updated: April 11, 2026</Text>
            <Text variant="lead">
              These Terms &amp; Conditions (&quot;Terms&quot;) govern your access to and use of
              Cloner (&quot;Cloner,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;), an
              interactive experience that may capture your likeness, voice, and other materials and
              produce an AI-generated digital representation. By using Cloner, you agree to these
              Terms.
            </Text>
          </Stack>

          <section aria-labelledby="terms-eligibility">
            <Stack gap="stack">
              <Heading variant="subtitle" as="h2" id="terms-eligibility">
                Eligibility
              </Heading>
              <Text>
                You represent that you are at least 18 years old, or the age of majority where you
                live, or that you have obtained a parent or legal guardian&apos;s permission to use
                Cloner. If you use Cloner on behalf of an organization, you represent that you have
                authority to bind that organization.
              </Text>
            </Stack>
          </section>

          <section aria-labelledby="terms-service">
            <Stack gap="stack">
              <Heading variant="subtitle" as="h2" id="terms-service">
                The service
              </Heading>
              <Text>
                Cloner may invite you to provide a photograph or video of your face, audio
                recordings of your voice, text or other information about yourself, and optional
                reactions or recordings. We may process these materials using automated and
                AI-assisted tools to generate outputs such as scripts, images, video, or other
                media—collectively, your &quot;AI digital copy&quot; or &quot;digital copy&quot;
                when referring to any synthetic or derived representation of you.
              </Text>
              <Text>
                Features, models, and outputs may change at any time. We do not guarantee any
                particular result, quality, or availability.
              </Text>
            </Stack>
          </section>

          <section aria-labelledby="terms-voice-clone">
            <Stack gap="stack">
              <Heading variant="subtitle" as="h2" id="terms-voice-clone">
                Voice cloning: legal rights and third-party rules
              </Heading>
              <Text>
                Where Cloner uses voice synthesis, cloning, or similar features, underlying providers
                (including ElevenLabs and comparable services) require that you only submit audio
                for voices you are lawfully allowed to clone. You must have the rights and, where
                needed, clear consent from the person whose voice is being cloned—including when
                that person is you.
              </Text>
              <Text>
                Those providers impose their own legal and ethical conditions and may require you to
                accept their terms separately. They actively enforce restrictions on unauthorized
                voice cloning and impersonation, including heightened scrutiny for public figures,
                celebrities, and other high-risk cases. If your submission violates their policies or
                applicable law, they may refuse processing, remove content, or take action against
                associated accounts—and we may block or limit your access to Cloner.
              </Text>
              <Text>
                You represent and warrant that any voice recording you provide is your own voice, or
                that you hold all rights and permissions required to use and clone that voice in
                connection with Cloner. You agree not to use Cloner to mimic, spoof, or clone a
                third party&apos;s voice without authorization.
              </Text>
            </Stack>
          </section>

          <section aria-labelledby="terms-data">
            <Stack gap="stack">
              <Heading variant="subtitle" as="h2" id="terms-data">
                Data you provide and where it is stored
              </Heading>
              <Text>
                When you use Cloner, you may upload or transmit photos, audio, video, reactions,
                biometric-related captures, and other content (&quot;Your Content&quot;). Your
                Content and outputs derived from it may be stored on servers we operate or control,
                including cloud storage and databases (for example, storage provided through
                Supabase or comparable infrastructure).
              </Text>
              <Text>
                We may also send Your Content to third-party service providers as needed to operate
                the experience—for example, providers of speech, image, video, or language models.
                Those providers process data under their own terms and policies in addition to
                these Terms.
              </Text>
              <Text>
                We may retain Your Content and derived outputs for as long as we believe
                appropriate for operating, securing, improving, and analyzing Cloner, unless a
                shorter period is required by law.
              </Text>
            </Stack>
          </section>

          <section aria-labelledby="terms-license">
            <Stack gap="stack">
              <Heading variant="subtitle" as="h2" id="terms-license">
                License to your likeness, voice, and AI digital copy
              </Heading>
              <Text>
                By checking the box that references these Terms or by otherwise using Cloner, you
                grant Cloner a worldwide, irrevocable, perpetual, sublicensable, transferable,
                royalty-free license to use, reproduce, modify, adapt, prepare derivative works
                from, distribute, publicly perform, publicly display, transmit, and otherwise
                exploit Your Content and any AI digital copy created from it—including your
                likeness, voice, mannerisms, and any synthetic or generated representation of
                you—for any purpose, in any medium now known or later developed, without further
                notice or compensation to you.
              </Text>
              <Text>
                This license includes, without limitation, use for research, art, product
                development, marketing, promotion, commercial exploitation, and sublicensing to
                third parties, and is effective immediately upon your acceptance of these Terms.
              </Text>
              <Text>
                To the extent any moral rights or similar rights apply, you waive them to the
                maximum extent permitted by law, or agree not to assert them against Cloner or its
                licensees.
              </Text>
            </Stack>
          </section>

          <section aria-labelledby="terms-prohibited">
            <Stack gap="stack">
              <Heading variant="subtitle" as="h2" id="terms-prohibited">
                Prohibited conduct
              </Heading>
              <Text>You agree not to:</Text>
              <Text as="div">
                <ul className="list-disc space-y-2 pl-6">
                  <li>Use Cloner for any unlawful purpose or in violation of applicable law.</li>
                  <li>
                    Harass, threaten, defame, or harm others, or upload content that infringes
                    someone else&apos;s rights.
                  </li>
                  <li>
                    Attempt to deceive, defraud, or impersonate another person or entity in a way
                    that could cause harm.
                  </li>
                  <li>
                    Interfere with or disrupt Cloner, attempt unauthorized access to our systems, or
                    scrape or overload the service.
                  </li>
                </ul>
              </Text>
            </Stack>
          </section>

          <section aria-labelledby="terms-disclaimer">
            <Stack gap="stack">
              <Heading variant="subtitle" as="h2" id="terms-disclaimer">
                Disclaimers
              </Heading>
              <Text>
                Cloner and all outputs are provided &quot;as is&quot; and &quot;as available.&quot;
                We disclaim all warranties, express or implied, including merchantability, fitness
                for a particular purpose, and non-infringement, to the fullest extent permitted by
                law.
              </Text>
              <Text>
                AI-generated materials may be inaccurate, offensive, or inappropriate. They are not
                professional, medical, legal, or financial advice. You are solely responsible for how
                you interpret or use outputs.
              </Text>
            </Stack>
          </section>

          <section aria-labelledby="terms-liability">
            <Stack gap="stack">
              <Heading variant="subtitle" as="h2" id="terms-liability">
                Limitation of liability
              </Heading>
              <Text>
                To the fullest extent permitted by law, Cloner and its operators, contributors, and
                affiliates will not be liable for any indirect, incidental, special,
                consequential, or punitive damages, or any loss of profits, data, goodwill, or
                other intangible losses, arising from your use of Cloner or Your Content.
              </Text>
              <Text>
                Our total liability for any claim arising out of these Terms or Cloner is limited
                to the greater of (a) the amount you paid us to use Cloner in the twelve months
                before the claim, or (b) one hundred U.S. dollars (USD $100), if you paid nothing.
              </Text>
            </Stack>
          </section>

          <section aria-labelledby="terms-indemnity">
            <Stack gap="stack">
              <Heading variant="subtitle" as="h2" id="terms-indemnity">
                Indemnity
              </Heading>
              <Text>
                You will defend, indemnify, and hold harmless Cloner and its operators from any
                claims, damages, losses, liabilities, and expenses (including reasonable
                attorneys&apos; fees) arising from Your Content, your use of Cloner, or your
                violation of these Terms.
              </Text>
            </Stack>
          </section>

          <section aria-labelledby="terms-termination">
            <Stack gap="stack">
              <Heading variant="subtitle" as="h2" id="terms-termination">
                Termination
              </Heading>
              <Text>
                We may suspend or terminate access to Cloner at any time, with or without notice.
                Provisions of these Terms that by their nature should survive—including licenses
                granted, disclaimers, limitations of liability, indemnity, and governing
                law—survive termination.
              </Text>
            </Stack>
          </section>

          <section aria-labelledby="terms-changes">
            <Stack gap="stack">
              <Heading variant="subtitle" as="h2" id="terms-changes">
                Changes to these Terms
              </Heading>
              <Text>
                We may modify these Terms at any time. We will post the updated Terms on this page
                and update the &quot;Last updated&quot; date. Your continued use of Cloner after
                changes become effective constitutes acceptance of the revised Terms. If you do not
                agree, stop using Cloner.
              </Text>
            </Stack>
          </section>

          <section aria-labelledby="terms-law">
            <Stack gap="stack">
              <Heading variant="subtitle" as="h2" id="terms-law">
                Governing law
              </Heading>
              <Text>
                These Terms are governed by the laws of the jurisdiction in which Cloner operates,
                without regard to conflict-of-law principles, unless mandatory consumer protections
                in your jurisdiction require otherwise.
              </Text>
            </Stack>
          </section>

          <section aria-labelledby="terms-contact">
            <Stack gap="stack">
              <Heading variant="subtitle" as="h2" id="terms-contact">
                Contact
              </Heading>
              <Text>
                For questions about these Terms, contact the Cloner project maintainers at the
                channel or address published with the work, or via your project&apos;s designated
                contact if one is listed alongside Cloner.
              </Text>
            </Stack>
          </section>
        </Stack>
      </Container>
    </div>
  )
}
