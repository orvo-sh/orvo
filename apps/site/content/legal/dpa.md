---
title: Data processing addendum
description: Terms for processing customer personal data through Orvo Cloud.
order: 3
draft: true
---

# Data processing addendum

Last revised: November 18, 2026. Effective date: November 18, 2026.

This data processing addendum ("DPA") forms part of the agreement between **Sopeasy, LLC** ("processor", "we") and the customer using Orvo Cloud ("customer", "you") when we process personal data on your behalf. It takes effect when incorporated into an accepted service agreement. It prevails over conflicting service terms concerning that processing.

"Applicable data protection law" means privacy and data protection laws applicable to the processing, including the EU GDPR and UK GDPR where relevant. "Personal data", "processing", "controller", "processor", and "personal data breach" have their meanings under those laws. Customer personal data means personal data in content you submit to the service; it excludes information for which we act as an independent controller as described in our [privacy policy](/legal/privacy-policy).

## Roles and instructions

You act as controller, or as a processor authorized by the relevant controller to appoint us as a subprocessor. You determine the purposes and means of processing and are responsible for a lawful basis, appropriate notices, data accuracy, and lawful instructions.

We will process customer personal data only on your documented instructions, including this DPA, your service configuration, authorized API requests, enabled integrations, and support instructions. These instructions include transfers necessary to provide the agreed service, subject to the transfer safeguards below. If law requires processing outside those instructions, we will inform you beforehand unless prohibited by law. We will promptly inform you if, in our opinion, an instruction infringes applicable data protection law and may suspend that instruction while we seek clarification.

## Processing details

| Item                  | Description                                                                                                                                                       |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Subject matter        | Providing the hosted Orvo observability service and customer-authorized support                                                                                   |
| Duration              | The service agreement's duration and the limited return/deletion period described below                                                                           |
| Nature of processing  | Collection, receipt, storage, indexing, querying, analysis, retrieval, transmission, display, restriction, and deletion                                           |
| Purposes              | Observability, incident investigation, monitoring, alerts, integrations, AI-assisted analysis requested by the customer, and securing the service                 |
| Data subjects         | Customer personnel, contractors, application users, and other individuals whose information the customer includes in telemetry or service content                 |
| Personal data         | Identifiers, IP addresses, resource attributes, request metadata, log and trace content, and personal information included in messages or configured integrations |
| Special-category data | Not intended or required; the customer must filter it out unless separately agreed in writing with appropriate safeguards                                         |
| Frequency             | Continuous ingestion and storage, with other processing as requested by authorized users or configured workflows                                                  |

## Confidentiality and security

We will ensure persons authorized to process customer personal data are bound by confidentiality duties and receive access only as needed for their work. We will maintain technical and organizational measures appropriate to the processing risks, taking account of the state of the art, implementation costs, and nature, scope, context, and purposes of processing.

Our required measures include access controls and least privilege; protected transport; appropriate storage encryption; separation of customer access; credential protection; security updates; restricted recovery backups; monitoring of security-relevant events; incident response; and periodic review of the measures' effectiveness, including recovery capability. We will not materially reduce the overall protection during the service term.

[Before this DPA becomes effective, verify these measures against production operations and maintain a detailed security schedule available to customers on request.]

## Subprocessors

You give general written authorization to engage subprocessors necessary to provide the service. Before a subprocessor processes customer personal data, we will enter a written agreement imposing substantially equivalent data protection obligations for its work. We remain responsible to you for its performance of those obligations.

The initial provider register to verify before this DPA becomes effective is:

| Provider            | Purpose and data involved                                                                      | Location / confirmation needed                                                                                         |
| ------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Amazon Web Services | Application hosting, databases, and recovery backups; customer content                         | Primary infrastructure in Frankfurt, Germany (`eu-central-1`); confirm contracting entity and support-access locations |
| Cloudflare          | Website delivery and configured object storage; request metadata and content placed in storage | Confirm contracting entity, storage jurisdiction, and access locations                                                 |
| OpenAI              | Scout inference; prompts, relevant chat context, and retrieved telemetry                       | Confirm contracting entity, endpoints, retention, region, and transfer safeguards                                      |
| Resend              | Transactional email; recipients and necessary message content                                  | Confirm production use, contracting entity, processing locations, and safeguards                                       |

Stripe handles billing information, and Umami provides website analytics. Their role for information we control is described in our privacy policy; they are not authorized by this DPA to receive customer telemetry for unrelated purposes. [Confirm whether Umami is self-hosted and update the register if any additional provider processes customer personal data.]

We will provide at least 30 days' advance notice of intended additions or replacements through account email or a notice sent to a customer-designated contact. You may object on reasonable data protection grounds during that period. We will work in good faith to resolve the objection or offer an alternative. If no reasonable solution is available, you may terminate the affected service before the change, with a proportional refund of unused prepaid base fees. We will not send your data to the disputed new subprocessor while an objection remains unresolved unless you agree to the change.

## AI processing restrictions

We will not train or fine-tune AI models on customer personal data or other customer content, and will not authorize providers to do so. AI inference is limited to delivering the features you request. We will not opt customer data into provider training or data-sharing programs. Provider retention for security or abuse monitoring must be separately disclosed and covered by appropriate contractual terms; a no-training commitment does not mean zero retention.

## Assistance and individual rights

Taking account of the nature of processing and information available to us, we will provide reasonable assistance with data-subject requests, security obligations, breach notifications, data protection impact assessments, and prior consultations with supervisory authorities. If we receive a request relating to customer personal data, we will promptly forward it to you and will not respond substantively except on your instructions or as legally required.

We will make available information necessary to demonstrate compliance with this DPA. We will allow and contribute to audits, including inspections, by you or an independent auditor you appoint, subject to reasonable notice, confidentiality, and safeguards for other customers. Documentation or independent reports may be used first where sufficient, but will not prevent an audit required by law or a competent authority. Reasonable scheduling conditions must not obstruct statutory rights.

## Personal data breaches

We will notify you without undue delay after becoming aware of a personal data breach involving customer personal data. We will provide available information about its nature, affected data and individuals where known, likely consequences, mitigation, and a contact for follow-up. We may provide information in stages as it becomes available. We will take reasonable containment and remediation steps and assist you in meeting your notification obligations. You remain responsible for notifying authorities and individuals unless law requires us to do so.

## International transfers

The primary application and database infrastructure is in Frankfurt. This does not itself eliminate restricted transfers: Sopeasy, LLC is a US entity, and provider processing or remote access may occur elsewhere.

We will not make a restricted transfer unless an applicable lawful mechanism is in place, including any required assessment and supplementary measures. Where standard contractual clauses are required, the parties must complete and execute the applicable clauses and annexes, and any required UK addendum or other local instrument, before the transfer. This DPA alone does not replace those instruments or certify compliance.

[Before accepting restricted-transfer data, confirm the parties' legal identities, relevant controller-to-processor or processor-to-processor module, supervisory authority, governing law, processing locations, transfer assessment, and completed security annexes. Make the executed safeguards available to the customer.]

## Return, retention, and deletion

During the service term, customer telemetry is retained according to the selected plan. You may request return of available customer personal data before termination; we will provide reasonable assistance in a commonly used format. Plan-expired data cannot be returned.

At the end of processing, at your choice, we will return or delete customer personal data and delete remaining copies, unless applicable law requires retention. We will remove customer personal data from active systems within 30 days of a verified deletion instruction or termination requiring deletion, subject to any shorter legally required deadline. Recovery backups will expire within 90 days after active-system deletion. Until expiry, backup copies remain protected, isolated from ordinary use, and processed only for recovery, security, or legal requirements; we will reapply deletion instructions after recovery.

If retention is legally required, we will identify the requirement where lawful, restrict the retained information to that purpose, and delete it when the requirement ends. We will confirm completion of deletion on request.

## Liability and contact

Liability between the parties is governed by the service agreement, subject to applicable law and any transfer instrument that takes priority. Nothing in this DPA restricts a data subject's statutory rights or a supervisory authority's powers.

Privacy, security, and DPA requests: **Sopeasy, LLC**, [team@orvo.sh](mailto:team@orvo.sh).

Customer identity and contact: as recorded in the accepted order or service agreement.
