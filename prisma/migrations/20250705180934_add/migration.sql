/*
  Warnings:

  - Added the required column `sandboxUrl` to the `Fragment` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Fragment" ADD COLUMN     "sandboxUrl" TEXT NOT NULL;
