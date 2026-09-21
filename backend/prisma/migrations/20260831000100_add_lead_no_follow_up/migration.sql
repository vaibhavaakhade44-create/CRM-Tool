-- Lead: explicit "no follow-up needed" flag (used by WBA to suppress the 48h auto-overdue rule)
ALTER TABLE "Lead" ADD COLUMN "noFollowUp" BOOLEAN NOT NULL DEFAULT false;
