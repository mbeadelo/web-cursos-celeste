import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PublishArticleSwitch, DeleteArticleButton } from "./_row-actions";

export const metadata: Metadata = { title: "Artículos" };

const dateFormatter = new Intl.DateTimeFormat("es-ES", { dateStyle: "medium" });
const dateTimeFormatter = new Intl.DateTimeFormat("es-ES", {
  dateStyle: "medium",
  timeStyle: "short",
});

export default async function AdminArticlesPage() {
  const now = new Date();
  const articles = await db.article.findMany({
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      slug: true,
      title: true,
      published: true,
      publishedAt: true,
      createdAt: true,
    },
  });

  return (
    <main className="px-6 py-12">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="flex items-baseline justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Artículos</h1>
            <p className="text-sm text-neutral-600">
              {articles.length} artículo{articles.length === 1 ? "" : "s"} en total.
            </p>
          </div>
          <Button render={<Link href="/admin/articulos/new" />}>Nuevo artículo</Button>
        </header>

        {articles.length === 0 ? (
          <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-12 text-center">
            <p className="text-neutral-600">Aún no hay artículos.</p>
            <Button className="mt-4" render={<Link href="/admin/articulos/new" />}>
              Escribir el primero
            </Button>
          </div>
        ) : (
          <div className="rounded-lg border border-neutral-200 bg-white overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Publicado</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {articles.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.title}</TableCell>
                    <TableCell className="font-mono text-xs text-neutral-600">
                      {a.slug}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <PublishArticleSwitch
                          id={a.id}
                          initialPublished={a.published}
                        />
                        {a.published && a.publishedAt && a.publishedAt > now && (
                          <span className="text-[11px] font-medium text-amber-600">
                            Programado
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-neutral-600">
                      {a.published && a.publishedAt && a.publishedAt > now
                        ? dateTimeFormatter.format(a.publishedAt)
                        : dateFormatter.format(a.publishedAt ?? a.createdAt)}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        render={<Link href={`/admin/articulos/${a.id}`} />}
                      >
                        Editar
                      </Button>
                      <DeleteArticleButton id={a.id} title={a.title} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </main>
  );
}
