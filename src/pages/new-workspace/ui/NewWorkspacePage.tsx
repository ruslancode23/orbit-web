import { CreateWorkspaceWizard } from '@/features/create-workspace'

/** Creating a server: a page of its own, reached by «+» in the server rail. */
const NewWorkspacePage = () => {
  return (
    <section aria-labelledby="new-workspace-title" className="flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-lg flex-col gap-6 px-6 py-10">
        <header className="flex flex-col gap-1">
          <h1 id="new-workspace-title" className="text-2xl font-semibold">
            Новый сервер
          </h1>
          <p className="text-sm text-fg-muted">
            Вы станете его владельцем. Всё это можно поменять потом в настройках сервера.
          </p>
        </header>
        <CreateWorkspaceWizard />
      </div>
    </section>
  )
}

export default NewWorkspacePage
