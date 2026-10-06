import type { Metadata } from "next";
import Link from "next/link";
import { ContactLink, LegalPage, type LegalSection } from "@/components/marketing/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "What personal data ShipBrief collects, why, and the choices you have.",
};

const sections: LegalSection[] = [
  {
    id: "who-we-are",
    title: "Who we are",
    body: (
      <>
        <p>
          ShipBrief is a release communication tool for product teams. This policy explains how ShipBrief handles personal data when you visit our website, use the app, or interact with
          a changelog, widget or email sent through ShipBrief. You can reach us about anything in this policy at <ContactLink />.
        </p>
        <p>
          We handle personal data in line with Rwanda&rsquo;s Law No. 058/2021 relating to the protection of personal data and privacy, and aim to meet the standards of other privacy laws,
          such as the GDPR, that may apply to you.
        </p>
      </>
    ),
  },
  {
    id: "roles",
    title: "Our role",
    body: (
      <ul>
        <li>
          <strong>For ShipBrief accounts</strong> (the people who sign up and use the app), we decide how your data is used and are responsible for it.
        </li>
        <li>
          <strong>For our customers&rsquo; audiences</strong> (subscribers, contacts and visitors to a customer&rsquo;s changelog or widget), we process data on behalf of that customer,
          who is responsible for it. If you received an email from a company that uses ShipBrief, contact that company first about your data. You can always unsubscribe using the link in
          the email.
        </li>
      </ul>
    ),
  },
  {
    id: "what-we-collect",
    title: "What we collect",
    body: (
      <ul>
        <li>
          <strong>Account details:</strong> your name, email address, a securely hashed password, and your workspace name. If you sign in with Google or GitHub, we receive your name,
          email address and profile picture from that provider.
        </li>
        <li>
          <strong>Workspace content:</strong> releases, drafts, feedback, roadmap items, branding, uploaded files, team members and invitations.
        </li>
        <li>
          <strong>Integration data:</strong> when you connect GitHub, GitLab, Linear or Jira, we store an encrypted access token and read the work items, pull requests or issues needed to
          draft releases.
        </li>
        <li>
          <strong>Audience data:</strong> email addresses and names of subscribers and contacts our customers add, plus email delivery, open and unsubscribe status.
        </li>
        <li>
          <strong>Engagement:</strong> views, clicks, reactions and comments on public changelogs and the in-app widget. The widget stores an anonymous visitor ID in your browser so it
          remembers which updates you&rsquo;ve read.
        </li>
        <li>
          <strong>Security and usage logs:</strong> IP address, browser user agent and timestamps for sign-ins and sessions, used to keep accounts secure and prevent abuse.
        </li>
        <li>
          <strong>Billing:</strong> if you subscribe to a paid plan, Stripe processes your payment details. We don&rsquo;t see or store your full card number.
        </li>
      </ul>
    ),
  },
  {
    id: "how-we-use",
    title: "How we use it",
    body: (
      <>
        <ul>
          <li>To run ShipBrief: create your account, sign you in, store your work, publish changelogs and send the emails you ask us to send.</li>
          <li>To send account emails, such as email confirmation, password resets, security alerts, invitations and notifications.</li>
          <li>To generate AI drafts and rewrites when you request them.</li>
          <li>To keep the Service secure, prevent spam and abuse, and fix problems.</li>
          <li>To handle billing and meet legal obligations.</li>
        </ul>
        <p>
          We rely on performing our contract with you, our legitimate interest in running a secure service, your consent where required (for example, subscriber confirmations), and legal
          obligations. <strong>We don&rsquo;t sell personal data, and we don&rsquo;t show ads.</strong>
        </p>
      </>
    ),
  },
  {
    id: "ai",
    title: "AI processing",
    body: (
      <p>
        When you use AI features, the content needed for the request (such as release notes and linked work items) is sent to Anthropic, our AI provider, to generate a suggestion.
        Anthropic doesn&rsquo;t use data sent through its API to train its models. We don&rsquo;t use your content to train AI models either.
      </p>
    ),
  },
  {
    id: "providers",
    title: "Service providers",
    body: (
      <>
        <p>We share data only with providers that help us run ShipBrief, and only as needed for their service:</p>
        <ul>
          <li><strong>Vercel</strong>: hosting for the website and app.</li>
          <li><strong>Render</strong>: hosting for the ShipBrief API.</li>
          <li><strong>Neon</strong>: database hosting.</li>
          <li><strong>Google (Gmail) or Resend</strong>: email delivery.</li>
          <li><strong>Anthropic</strong>: AI drafting.</li>
          <li><strong>Stripe</strong>: payments.</li>
          <li><strong>Google and GitHub</strong>: sign-in, if you choose to use them.</li>
          <li><strong>GitHub, GitLab, Linear, Jira</strong>: only when you connect them.</li>
        </ul>
        <p>We may also disclose data if the law requires it, or to protect the rights and safety of our users and the Service.</p>
      </>
    ),
  },
  {
    id: "transfers",
    title: "International transfers",
    body: (
      <p>
        Our providers may store and process data outside your country, including in the United States and the European Union. When that happens, we rely on their contractual and security
        commitments to protect it.
      </p>
    ),
  },
  {
    id: "cookies",
    title: "Cookies and local storage",
    body: (
      <>
        <p>We keep this minimal and use no advertising or third-party tracking cookies.</p>
        <ul>
          <li><strong>sb_session</strong>: a secure, HTTP-only cookie that keeps you signed in. It&rsquo;s required for the app to work.</li>
          <li><strong>Local storage</strong>: remembers preferences such as your theme, and the widget&rsquo;s anonymous visitor ID.</li>
        </ul>
      </>
    ),
  },
  {
    id: "retention",
    title: "How long we keep data",
    body: (
      <ul>
        <li>Account and workspace data is kept while your account or workspace is active.</li>
        <li>When a workspace is deleted, its content is removed from our active systems. Backups held by our database provider expire on their normal schedule.</li>
        <li>Sign-in sessions expire after 30 days, or sooner when you sign out.</li>
        <li>Unsubscribed contacts are kept only as a suppression record, so they aren&rsquo;t emailed again.</li>
      </ul>
    ),
  },
  {
    id: "security",
    title: "Security",
    body: (
      <p>
        We use HTTPS for all traffic, hash passwords, encrypt integration tokens and webhook secrets at rest, and limit access to production systems. No system is perfectly secure; if
        we learn of a breach affecting your data, we&rsquo;ll notify you and the relevant authorities as the law requires.
      </p>
    ),
  },
  {
    id: "your-rights",
    title: "Your rights",
    body: (
      <>
        <p>Depending on where you live, you can ask to access, correct, delete or export your personal data, object to or restrict how we use it, and withdraw consent at any time.</p>
        <ul>
          <li>You can update your profile in the app, and workspace owners can delete a workspace from its settings.</li>
          <li>You can unsubscribe from any ShipBrief email using the link at the bottom of it.</li>
          <li>
            For anything else, email <ContactLink />. We&rsquo;ll respond within 30 days.
          </li>
        </ul>
        <p>You also have the right to complain to your data protection authority. In Rwanda, that&rsquo;s the National Cyber Security Authority (NCSA).</p>
      </>
    ),
  },
  {
    id: "children",
    title: "Children",
    body: <p>ShipBrief is a tool for businesses and isn&rsquo;t intended for anyone under 16. We don&rsquo;t knowingly collect data from children.</p>,
  },
  {
    id: "changes",
    title: "Changes to this policy",
    body: (
      <p>
        If we change this policy, we&rsquo;ll update the date at the top. For significant changes, we&rsquo;ll notify account owners by email or in the app before they take effect. See also
        our <Link href="/terms">Terms of Service</Link>.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro={<p>What ShipBrief collects, why we collect it, who we share it with, and the choices you have. We collect only what we need to run the product.</p>}
      sections={sections}
      related={{ href: "/terms", label: "Terms of Service" }}
    />
  );
}
