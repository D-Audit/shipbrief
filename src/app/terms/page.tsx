import type { Metadata } from "next";
import Link from "next/link";
import { ContactLink, LegalPage, type LegalSection } from "@/components/marketing/legal-page";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms that apply when you use ShipBrief.",
};

const sections: LegalSection[] = [
  {
    id: "agreement",
    title: "Agreement",
    body: (
      <>
        <p>
          These Terms of Service (&ldquo;Terms&rdquo;) govern your use of ShipBrief, including the website, the web app, public changelog pages, the in-app widget, emails sent through
          ShipBrief and the API (together, the &ldquo;Service&rdquo;). By creating an account or using the Service, you agree to these Terms and to our{" "}
          <Link href="/privacy">Privacy Policy</Link>.
        </p>
        <p>If you use ShipBrief on behalf of a company or other organisation, you confirm that you are authorised to accept these Terms for it, and &ldquo;you&rdquo; includes that organisation.</p>
      </>
    ),
  },
  {
    id: "accounts",
    title: "Accounts and workspaces",
    body: (
      <ul>
        <li>You must be at least 16 years old to use ShipBrief.</li>
        <li>Give accurate information when you sign up, and keep your password and sign-in methods secure. You are responsible for activity under your account.</li>
        <li>Workspace owners and admins control who has access to a workspace and what members can do. They are responsible for the people they invite.</li>
        <li>Tell us promptly at <ContactLink /> if you believe your account has been accessed without permission.</li>
      </ul>
    ),
  },
  {
    id: "your-content",
    title: "Your content",
    body: (
      <>
        <p>
          &ldquo;Your content&rdquo; means everything you or your team put into ShipBrief: releases, drafts, changelog entries, feedback, contacts and subscriber lists, branding, uploaded
          files, and data imported from connected tools such as GitHub, GitLab, Linear or Jira.
        </p>
        <p>
          You keep all rights to your content. You give us a limited licence to host, copy, process, transmit and display it only as needed to run the Service for you, for example to
          publish your changelog, send your release emails or generate AI drafts you ask for.
        </p>
        <p>You confirm that you have the rights to the content you add, and that publishing it through ShipBrief doesn&rsquo;t break any law or anyone else&rsquo;s rights.</p>
      </>
    ),
  },
  {
    id: "email",
    title: "Emails to your audience",
    body: (
      <>
        <p>
          ShipBrief lets you email release updates to your customers and subscribers. You are the sender of those messages and are responsible for having a lawful basis to contact the
          people on your lists, such as their consent.
        </p>
        <ul>
          <li>Only import or add contacts who have agreed to hear from you, or who you are otherwise allowed to email.</li>
          <li>Don&rsquo;t remove or hide the unsubscribe link ShipBrief adds. Unsubscribed contacts are not emailed again.</li>
          <li>Follow the anti-spam and marketing laws that apply to you and your recipients.</li>
        </ul>
        <p>We may pause sending from a workspace with high bounce or complaint rates to protect deliverability for everyone.</p>
      </>
    ),
  },
  {
    id: "ai",
    title: "AI features",
    body: (
      <>
        <p>
          ShipBrief can draft and rewrite release notes with AI. When you use these features, the relevant content is sent to our AI provider to produce a suggestion. AI output can be
          inaccurate or incomplete, so review it before publishing. Nothing is published until a person on your team approves it.
        </p>
        <p>You are responsible for what you choose to publish, including AI-assisted content. We don&rsquo;t use your content to train AI models.</p>
      </>
    ),
  },
  {
    id: "integrations",
    title: "Connected services",
    body: (
      <p>
        When you connect a third-party service (for example GitHub, GitLab, Linear, Jira or Google), you authorise ShipBrief to access it with the permissions you approve, only to provide
        the features you use. Your use of those services is governed by their own terms. You can disconnect an integration at any time from your workspace settings.
      </p>
    ),
  },
  {
    id: "acceptable-use",
    title: "Acceptable use",
    body: (
      <>
        <p>You agree not to:</p>
        <ul>
          <li>Send spam, phishing, or unsolicited bulk email, or publish content that is illegal, deceptive, hateful, or infringes someone else&rsquo;s rights.</li>
          <li>Upload malware, or try to break, overload, probe or get around the security or limits of the Service.</li>
          <li>Access another workspace&rsquo;s data without permission, or scrape the Service other than through the API as documented.</li>
          <li>Resell or sublicense the Service, or use it to build a competing product.</li>
        </ul>
      </>
    ),
  },
  {
    id: "plans",
    title: "Plans and billing",
    body: (
      <ul>
        <li>Paid plans are billed in advance through our payment processor, Stripe, and renew automatically until you cancel.</li>
        <li>Upgrades take effect immediately. Downgrades and cancellations take effect at the end of the current billing period.</li>
        <li>Fees are non-refundable except where the law requires otherwise. Prices exclude taxes unless stated.</li>
        <li>We may change prices with at least 30 days&rsquo; notice. Changes apply from your next billing period.</li>
        <li>If a payment fails, we may limit paid features until it is resolved.</li>
      </ul>
    ),
  },
  {
    id: "availability",
    title: "Availability and changes",
    body: (
      <p>
        We work to keep ShipBrief reliable, but we don&rsquo;t promise it will be uninterrupted or error-free. We may add, change or remove features over time. If we make a change that
        significantly reduces what a paid plan includes, we&rsquo;ll tell you in advance.
      </p>
    ),
  },
  {
    id: "termination",
    title: "Ending your use",
    body: (
      <>
        <p>You can stop using ShipBrief at any time. Workspace owners can delete a workspace from its settings, which permanently removes its content.</p>
        <p>
          We may suspend or close an account that seriously or repeatedly breaks these Terms, or where we&rsquo;re required to by law. Where reasonable, we&rsquo;ll give notice first and a
          chance to export your content.
        </p>
      </>
    ),
  },
  {
    id: "ip",
    title: "Our property",
    body: (
      <p>
        ShipBrief, including its software, design, logo and documentation, belongs to us. These Terms don&rsquo;t give you any rights to our brand. If you send us feedback or
        suggestions, we may use them without any obligation to you.
      </p>
    ),
  },
  {
    id: "disclaimers",
    title: "Disclaimers and liability",
    body: (
      <>
        <p>The Service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;. To the extent the law allows, we disclaim all implied warranties, including fitness for a particular purpose.</p>
        <p>
          To the extent the law allows, we are not liable for indirect, incidental or consequential losses, such as lost profits or lost data. Our total liability for any claim relating to
          the Service is limited to the amount you paid us in the 12 months before the claim. Nothing in these Terms limits liability that cannot be limited by law.
        </p>
        <p>You agree to cover us for claims arising from your content, the emails you send through ShipBrief, or your breach of these Terms.</p>
      </>
    ),
  },
  {
    id: "law",
    title: "Governing law",
    body: (
      <p>
        These Terms are governed by the laws of the Republic of Rwanda. Any dispute will be handled by the competent courts of Rwanda, unless the law where you live gives you the right to
        bring a claim locally.
      </p>
    ),
  },
  {
    id: "changes",
    title: "Changes to these Terms",
    body: (
      <p>
        We may update these Terms as ShipBrief evolves. We&rsquo;ll change the date at the top, and for significant changes we&rsquo;ll notify account owners by email or in the app before
        they take effect. Continuing to use ShipBrief after that means you accept the updated Terms.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    body: (
      <p>
        Questions about these Terms? Email <ContactLink />.
      </p>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      intro={<p>The rules for using ShipBrief, in plain language. Please read them, since they form a binding agreement between you and ShipBrief.</p>}
      sections={sections}
      related={{ href: "/privacy", label: "Privacy Policy" }}
    />
  );
}
