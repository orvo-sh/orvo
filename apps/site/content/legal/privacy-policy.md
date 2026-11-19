---
title: Privacy policy
description: How Sopeasy, LLC handles personal information, telemetry, AI processing, and privacy rights.
order: 2
draft: true
---

# Privacy policy

Last revised: November 18, 2026. Effective date: November 18, 2026.

**Sopeasy, LLC** operates Orvo. Contact us about privacy at [team@orvo.sh](mailto:team@orvo.sh).

## Scope and our role

This policy covers our website, hosted Orvo Cloud service, and communications with us. We act as a controller for account administration, billing, security, website analytics, and our business communications. When customers send personal data in telemetry or other customer content, we process it on their behalf under the [data processing addendum](/legal/dpa). The customer determines the purposes and legal basis for that processing and may itself act for another controller.

If your employer or another organization uses Orvo, contact that organization about personal information in its telemetry. We will assist it with requests as required. Independently self-hosted installations are operated by their administrators; this policy covers only data those administrators send to us or our hosted services.

## Information we process

- **Account and organization information:** name, email, authentication records, organization membership, permissions, and settings supplied by you or an administrator.
- **Billing information:** subscription details, invoices, payment status, and payment-provider identifiers. Stripe processes payment details; do not send payment-card data through telemetry or support messages.
- **Customer content:** logs, traces, metrics, resource attributes, incident and alert information, configuration, integration data, and Scout messages. Depending on instrumentation, this can include IP addresses, user identifiers, request paths, or other personal information.
- **Service and security records:** request metadata, device or browser information, timestamps, error records, and activity needed to operate and protect the service.
- **Communications:** support requests, feedback, and correspondence you send us.
- **Website analytics:** Umami measurements such as page views, referrers, browser and device categories, approximate location, and events we configure. [Confirm deployment, event configuration, and analytics retention before final publication.]

We receive information directly from you, from your organization and its instrumented systems, from integrations you enable, and from providers supporting the service. Avoid including secrets or unnecessary sensitive information in telemetry, chat, or analytics events.

## Purposes and legal bases

Where GDPR or similar law applies, we rely on the following bases for information we control:

| Purpose                                                                       | Legal basis                                                            |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Create accounts and provide services requested by an individual customer      | Performance of a contract                                              |
| Administer an organization's users, troubleshoot, and provide support         | Legitimate interests in operating the service and supporting customers |
| Prevent abuse, secure infrastructure, and investigate incidents               | Legitimate interests in protecting users and systems                   |
| Handle invoices, tax records, and lawful requests                             | Legal obligations, and contract performance where applicable           |
| Understand website use with proportionate analytics                           | Legitimate interests where permitted; consent where required           |
| Optional marketing communications or non-essential tracking requiring consent | Consent, or another permitted basis with an opt-out where applicable   |

For customer content processed on behalf of an organization, we follow its documented instructions; it is responsible for choosing an appropriate legal basis. We do not use customer content for unrelated advertising.

## Scout and AI processing

Scout uses the OpenAI API. Prompts, relevant conversation history, and telemetry retrieved by Scout's tools may be sent to OpenAI to generate responses and carry out authorized workflows. Use these features only with information you are authorized to share.

**We never train AI models on customer data and do not permit our AI providers to train on it.** We will not opt customer data into provider training programs. OpenAI states that API inputs and outputs are not used for training by default. Provider retention for abuse monitoring and feature-specific application state is separate from training and depends on the API feature and our account settings. We do not represent that all requests have zero retention or remain in Frankfurt. See [OpenAI's data controls](https://developers.openai.com/api/docs/guides/your-data).

[Confirm the production OpenAI project's retention settings, endpoints, processing region, and transfer arrangements before final publication.]

## Cookies and Umami analytics

We use cookies or similar storage where needed for authentication, session security, and preferences. Blocking necessary storage may prevent sign-in or other requested functionality.

We use Umami for website analytics. Its standard analytics operates without tracking cookies. Our configuration must avoid sending names, emails, secrets, telemetry payloads, or other personal content in URLs, custom events, or identifiers. Where an analytics configuration or applicable law requires consent, we will obtain it before activating that processing. We do not use customer content for cross-site behavioral advertising.

[Verify the deployed cookie/storage inventory, Umami hosting and event settings, and whether any additional scripts require consent.]

## Sharing and service providers

We disclose information only as needed for the purposes described here, including to:

- **AWS:** primary application hosting, databases, and database backups in Frankfurt, Germany (`eu-central-1`).
- **Cloudflare:** website delivery and configured object storage. Exact storage location and support access depend on the deployed configuration.
- **OpenAI:** AI processing when Scout is used.
- **Stripe:** payments, subscription administration, and fraud prevention.
- **Resend:** transactional email delivery when enabled in production.
- **Umami:** website analytics; whether Umami is self-hosted or a separate cloud provider remains to be confirmed.
- Your organization's administrators, authorized users, and integrations you choose to connect, according to access settings.
- Professional advisers, authorities where legally required, or parties to a business transfer subject to appropriate protections.

Providers may act as processors or, for some payment and compliance activities, independent controllers. The [DPA](/legal/dpa) describes providers processing customer content and the process for subprocessor changes. We do not sell customer personal information or share it for cross-context behavioral advertising.

## Hosting and international transfers

Our primary application and databases are hosted on AWS in Frankfurt. This is not a guarantee that every provider processes all information exclusively in Germany. Sopeasy, LLC is a US entity, and third-party processing or support access may involve other countries.

Where restricted transfers occur, we will use a valid transfer mechanism, such as an applicable adequacy decision or properly executed standard contractual clauses with any required UK addendum, together with additional safeguards where needed. [Confirm applicable provider agreements, transfer assessments, and any EU/UK representative obligations before final publication.] You may request information about relevant safeguards at our contact email.

## Retention and deletion

We retain information for the purpose for which it was collected and the periods described below:

- **Telemetry:** the retention window in your plan; the current Pro plan is 30 days for logs, traces, and metrics.
- **Active account and customer content:** while needed to provide your service, then deleted from active systems within 30 days of a verified deletion request or termination requiring deletion, subject to applicable shorter deadlines.
- **Backups:** remaining copies expire within 90 days after deletion from active systems. Backups are restricted to recovery and security and are not used to restore deleted accounts to normal service. Deletion instructions are reapplied after a restore.
- **Billing and legal records:** for applicable tax, accounting, legal, or dispute-retention requirements, limited to the necessary records.
- **Support, security, and analytics records:** only as long as reasonably necessary for their purposes. [Set and document specific production schedules for these categories.]

Canceling a subscription stops renewal and does not itself request immediate account deletion. Contact us to request deletion. Some records may need to be retained to meet a legal obligation or resolve a dispute; we restrict retained records to that purpose and explain applicable exceptions when responding to a request. Provider-held records may have separate legally required or agreed retention periods.

## Security

We use technical and organizational measures appropriate to the information and risks, including access restrictions and safeguards for transmission and storage. Security requires ongoing maintenance, and no system can guarantee absolute security. Report suspected security issues privately to [team@orvo.sh](mailto:team@orvo.sh), without sending secrets or unnecessary personal data.

## Your rights

Depending on your location and applicable law, you may request access, correction, erasure, restriction, portability, or information about processing; object to processing based on legitimate interests; and withdraw consent without affecting earlier lawful processing. We do not use personal information to make solely automated decisions producing legal or similarly significant effects about individuals.

Send requests to [team@orvo.sh](mailto:team@orvo.sh). We may need proportionate information to verify your identity or authority. We will respond within applicable legal deadlines, normally within one month for GDPR requests, and explain any permitted extension or refusal. You may authorize an agent where applicable. We will not discriminate against you for exercising rights.

You may complain to your local data protection authority, including in the EEA or UK. If the information is in a customer's telemetry, direct your request to that customer; we will assist it under our DPA.

## Children

Orvo is a business service and is not directed to children under 18. We do not knowingly collect children's information through account registration. Contact us if you believe a child has provided personal information to us.

## Changes and contact

We will update the revision date when this policy changes and notify users of material changes through the service or email as appropriate. Where required, we will obtain consent before materially different processing.

Controller: **Sopeasy, LLC**. Email: [team@orvo.sh](mailto:team@orvo.sh).

EU/UK privacy representative, if required: [Assess applicability and add contact details].
