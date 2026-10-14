-- Admin-only unsigned agreement drafting. Master and client draft are separate.
-- The master template body is seeded from src/lib/agreements/master-template.md
-- and must be reviewed by Australian counsel before ANY use for signing.
CREATE TABLE IF NOT EXISTS public.agency_agreement_templates (
  template_key text PRIMARY KEY CHECK(template_key ~ '^[a-z0-9_-]{3,60}$'),
  title text NOT NULL CHECK(length(title) BETWEEN 3 AND 160),
  body_markdown text NOT NULL CHECK(length(body_markdown) BETWEEN 300 AND 80000),
  version integer NOT NULL DEFAULT 1 CHECK(version>0),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.agency_agreement_templates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.agency_agreement_templates FROM anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.agency_agreement_templates TO authenticated;
CREATE POLICY "Agency managers read agreement templates" ON public.agency_agreement_templates
 FOR SELECT TO authenticated
 USING (EXISTS(SELECT 1 FROM public.agency_admins a WHERE a.user_id=(SELECT auth.uid())));
CREATE POLICY "Agency managers insert agreement templates" ON public.agency_agreement_templates
 FOR INSERT TO authenticated
 WITH CHECK (EXISTS(SELECT 1 FROM public.agency_admins a WHERE a.user_id=(SELECT auth.uid())));
CREATE POLICY "Agency managers update agreement templates" ON public.agency_agreement_templates
 FOR UPDATE TO authenticated
 USING (EXISTS(SELECT 1 FROM public.agency_admins a WHERE a.user_id=(SELECT auth.uid())))
 WITH CHECK (EXISTS(SELECT 1 FROM public.agency_admins a WHERE a.user_id=(SELECT auth.uid())));

CREATE TABLE IF NOT EXISTS public.client_agreement_drafts (
  client_id uuid PRIMARY KEY REFERENCES public.clients(id) ON DELETE CASCADE,
  template_key text NOT NULL REFERENCES public.agency_agreement_templates(template_key),
  body_markdown text NOT NULL CHECK(length(body_markdown) BETWEEN 300 AND 80000),
  source_version integer NOT NULL CHECK(source_version>0),
  revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.client_agreement_drafts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.client_agreement_drafts FROM anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.client_agreement_drafts TO authenticated;
CREATE POLICY "Agency managers read client drafts" ON public.client_agreement_drafts
 FOR SELECT TO authenticated
 USING (EXISTS(SELECT 1 FROM public.agency_admins a WHERE a.user_id=(SELECT auth.uid())));
CREATE POLICY "Agency managers insert client drafts" ON public.client_agreement_drafts
 FOR INSERT TO authenticated
 WITH CHECK (EXISTS(SELECT 1 FROM public.agency_admins a WHERE a.user_id=(SELECT auth.uid())));
CREATE POLICY "Agency managers update client drafts" ON public.client_agreement_drafts
 FOR UPDATE TO authenticated
 USING (EXISTS(SELECT 1 FROM public.agency_admins a WHERE a.user_id=(SELECT auth.uid())))
 WITH CHECK (EXISTS(SELECT 1 FROM public.agency_admins a WHERE a.user_id=(SELECT auth.uid())));
COMMENT ON TABLE public.agency_agreement_templates IS
 'ADMIN DRAFT ONLY. Master clauses; not legally approved or signed here.';
COMMENT ON TABLE public.client_agreement_drafts IS
 'ADMIN DRAFT ONLY. Client-specific unsigned agreement, not sent to SignWell.';
