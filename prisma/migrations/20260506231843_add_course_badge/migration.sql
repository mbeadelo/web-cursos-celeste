-- CreateEnum
CREATE TYPE "CourseBadge" AS ENUM ('BESTSELLER', 'NEW', 'COMING_SOON');

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "badge" "CourseBadge",
ADD COLUMN     "featuredOrder" INTEGER;
