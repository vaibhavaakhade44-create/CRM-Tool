-- AlterEnum
-- Adds WBA-specific compensation categories to the shared SalaryType enum.
ALTER TYPE "SalaryType" ADD VALUE IF NOT EXISTS 'FIXED';
ALTER TYPE "SalaryType" ADD VALUE IF NOT EXISTS 'UNPAID';
ALTER TYPE "SalaryType" ADD VALUE IF NOT EXISTS 'INCENTIVE';
