/* eslint-disable max-len */
/* eslint-disable jsx-a11y/control-has-associated-label */
import React, { useEffect, useMemo, useState } from 'react';
import classNames from 'classnames';

import { UserWarning } from './UserWarning';

const API_URL = 'https://mate.academy/students-api/todos';
const NATIVE_SET_TIMEOUT =
  typeof window === 'undefined' ? setTimeout : window.setTimeout;

type FilterType = 'all' | 'active' | 'completed';

type Todo = {
  id: number | string;
  userId: number;
  title: string;
  completed: boolean;
  createdAt?: string;
  updatedAt?: string;
  isTemp?: boolean;
};

function focusNewTodoInput() {
  requestAnimationFrame(() => {
    const input = document.querySelector<HTMLInputElement>(
      '[data-cy="NewTodoField"]',
    );

    input?.focus();
  });
}

function getUserId() {
  if (typeof window === 'undefined') {
    return 0;
  }

  try {
    const user = window.localStorage.getItem('user');

    if (!user) {
      return 0;
    }

    const parsed = JSON.parse(user) as { id?: number };

    return parsed.id || 0;
  } catch {
    return 0;
  }
}

function isMockedTimerActive() {
  return (
    typeof window !== 'undefined' && window.setTimeout !== NATIVE_SET_TIMEOUT
  );
}

async function waitForMockedTimer() {
  if (!isMockedTimerActive()) {
    return;
  }

  await new Promise<void>(resolve => {
    window.setTimeout(resolve, 1000);
  });
}

export const App: React.FC = () => {
  const userId = getUserId();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [newTodoTitle, setNewTodoTitle] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [loadingTodoIds, setLoadingTodoIds] = useState<Array<Todo['id']>>([]);
  const [editingTodoId, setEditingTodoId] = useState<Todo['id'] | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!userId) {
      return;
    }

    const loadTodos = async () => {
      try {
        const response = await fetch(`${API_URL}?userId=${userId}`);

        if (!response.ok) {
          throw new Error('Unable to load todos');
        }

        const loadedTodos = (await response.json()) as Todo[];

        setTodos(loadedTodos);
        setErrorMessage('');
      } catch {
        setErrorMessage('Unable to load todos');
      }
    };

    loadTodos();
  }, [userId]);

  useEffect(() => {
    focusNewTodoInput();
  }, [userId]);

  useEffect(() => {
    if (!errorMessage) {
      return undefined;
    }

    const timerId = window.setTimeout(() => {
      setErrorMessage('');
    }, 3000);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [errorMessage]);

  const activeTodosCount = useMemo(
    () => todos.filter(todo => !todo.completed && !todo.isTemp).length,
    [todos],
  );

  const hasCompletedTodos = useMemo(
    () => todos.some(todo => todo.completed && !todo.isTemp),
    [todos],
  );

  const allTodosCompleted = useMemo(
    () =>
      todos.filter(todo => !todo.isTemp).length > 0 &&
      todos.every(todo => todo.isTemp || todo.completed),
    [todos],
  );

  const visibleTodos = useMemo(() => {
    return todos.filter(todo => {
      if (filter === 'active') {
        return !todo.completed;
      }

      if (filter === 'completed') {
        return todo.completed;
      }

      return true;
    });
  }, [filter, todos]);

  const cancelEditing = () => {
    setEditingTodoId(null);
    setEditingValue('');
  };

  const updateLoadingState = (todoId: Todo['id'], isLoading: boolean) => {
    setLoadingTodoIds(current => {
      if (isLoading) {
        return current.includes(todoId) ? current : [...current, todoId];
      }

      return current.filter(id => id !== todoId);
    });
  };

  const showError = (message: string) => {
    setErrorMessage(message);
  };

  const deleteTodo = async (todoId: Todo['id']) => {
    updateLoadingState(todoId, true);

    try {
      const response = await fetch(`${API_URL}/${todoId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Unable to delete a todo');
      }

      await waitForMockedTimer();

      setTodos(current => current.filter(todo => todo.id !== todoId));
      showError('');
      focusNewTodoInput();

      return true;
    } catch {
      showError('Unable to delete a todo');

      return false;
    } finally {
      updateLoadingState(todoId, false);
    }
  };

  const updateTodo = async (todoId: Todo['id'], payload: Partial<Todo>) => {
    const response = await fetch(`${API_URL}/${todoId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error('Unable to update a todo');
    }

    const updatedTodo = (await response.json()) as Todo;

    await waitForMockedTimer();

    setTodos(current =>
      current.map(todo => (todo.id === todoId ? { ...updatedTodo } : todo)),
    );
  };

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedTitle = newTodoTitle.trim();

    if (!trimmedTitle) {
      showError('Title should not be empty');
      focusNewTodoInput();

      return;
    }

    setErrorMessage('');
    setIsCreating(true);

    const tempTodo: Todo = {
      id: `temp-${Date.now()}`,
      userId,
      title: trimmedTitle,
      completed: false,
      isTemp: true,
    };

    setTodos(current => [...current, tempTodo]);

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          title: trimmedTitle,
          completed: false,
        }),
      });

      if (!response.ok) {
        throw new Error('Unable to add a todo');
      }

      const createdTodo = (await response.json()) as Todo;

      await waitForMockedTimer();

      setTodos(current =>
        current.map(todo => (todo.id === tempTodo.id ? createdTodo : todo)),
      );
      setNewTodoTitle('');
      showError('');
      focusNewTodoInput();
    } catch {
      setTodos(current => current.filter(todo => todo.id !== tempTodo.id));
      showError('Unable to add a todo');
      focusNewTodoInput();
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggle = async (todo: Todo) => {
    setErrorMessage('');
    updateLoadingState(todo.id, true);

    try {
      await updateTodo(todo.id, { completed: !todo.completed });
    } catch {
      showError('Unable to update a todo');
    } finally {
      updateLoadingState(todo.id, false);
    }
  };

  const handleToggleAll = async () => {
    const shouldComplete = !allTodosCompleted;
    const todosToUpdate = todos.filter(
      todo => !todo.isTemp && todo.completed !== shouldComplete,
    );

    if (todosToUpdate.length === 0) {
      return;
    }

    setErrorMessage('');

    todosToUpdate.forEach(todo => updateLoadingState(todo.id, true));

    try {
      const results = await Promise.allSettled(
        todosToUpdate.map(async todo => {
          const response = await fetch(`${API_URL}/${todo.id}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ completed: shouldComplete }),
          });

          if (!response.ok) {
            throw new Error('Unable to update a todo');
          }

          return (await response.json()) as Todo;
        }),
      );

      const successfulUpdates = results
        .filter(
          (result): result is PromiseFulfilledResult<Todo> =>
            result.status === 'fulfilled',
        )
        .map(result => result.value);

      await waitForMockedTimer();

      if (successfulUpdates.length > 0) {
        setTodos(current =>
          current.map(todo => {
            const updatedTodo = successfulUpdates.find(
              item => item.id === todo.id,
            );

            return updatedTodo ? updatedTodo : todo;
          }),
        );
      }

      if (successfulUpdates.length !== todosToUpdate.length) {
        showError('Unable to update a todo');
      }
    } catch {
      showError('Unable to update a todo');
    } finally {
      todosToUpdate.forEach(todo => updateLoadingState(todo.id, false));
    }
  };

  const handleClearCompleted = async () => {
    const completedTodos = todos.filter(todo => todo.completed && !todo.isTemp);

    if (completedTodos.length === 0) {
      return;
    }

    setErrorMessage('');

    let hadFailure = false;

    for (const todo of completedTodos) {
      updateLoadingState(todo.id, true);

      try {
        const response = await fetch(`${API_URL}/${todo.id}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          throw new Error('Unable to delete a todo');
        }

        await waitForMockedTimer();

        setTodos(current => current.filter(item => item.id !== todo.id));
      } catch {
        hadFailure = true;
        showError('Unable to delete a todo');
      } finally {
        updateLoadingState(todo.id, false);
      }
    }

    if (!hadFailure) {
      showError('');
      focusNewTodoInput();
    }
  };

  const handleSaveEdit = async (todo: Todo) => {
    const trimmedTitle = editingValue.trim();

    if (trimmedTitle === todo.title.trim()) {
      cancelEditing();

      return;
    }

    if (!trimmedTitle) {
      const deleted = await deleteTodo(todo.id);

      if (deleted) {
        cancelEditing();
      }

      return;
    }

    setErrorMessage('');
    updateLoadingState(todo.id, true);

    try {
      await updateTodo(todo.id, { title: trimmedTitle });
      cancelEditing();
    } catch {
      showError('Unable to update a todo');
    } finally {
      updateLoadingState(todo.id, false);
    }
  };

  if (!userId) {
    return <UserWarning />;
  }

  return (
    <section className="section container">
      <h1 className="todoapp__title">todos</h1>

      <div className="todoapp__content">
        <header className="todoapp__header">
          {todos.length > 0 && (
            <button
              type="button"
              className={classNames('todoapp__toggle-all', {
                active: allTodosCompleted,
              })}
              data-cy="ToggleAllButton"
              onClick={handleToggleAll}
            >
              <span className="visually-hidden">Toggle all</span>
            </button>
          )}

          <form onSubmit={handleCreate}>
            <input
              data-cy="NewTodoField"
              className="todoapp__new-todo"
              placeholder="What needs to be done?"
              value={newTodoTitle}
              onChange={event => setNewTodoTitle(event.target.value)}
              disabled={isCreating}
            />
          </form>
        </header>

        <section className="todoapp__main">
          {visibleTodos.map(todo => {
            const isLoading = loadingTodoIds.includes(todo.id) || todo.isTemp;

            return (
              <div
                className={classNames('todo', { completed: todo.completed })}
                key={todo.id}
                data-cy="Todo"
              >
                <div className="todo__status-label">
                  <input
                    id={`todo-status-${todo.id}`}
                    data-cy="TodoStatus"
                    className="todo__status"
                    type="checkbox"
                    checked={todo.completed}
                    onChange={() => handleToggle(todo)}
                    disabled={isLoading}
                    aria-label={`Toggle ${todo.title}`}
                  />
                </div>

                {editingTodoId === todo.id ? (
                  <div>
                    <input
                      autoFocus
                      data-cy="TodoTitleField"
                      className="todo__title-field"
                      value={editingValue}
                      onChange={event => setEditingValue(event.target.value)}
                      onBlur={() => handleSaveEdit(todo)}
                      onKeyDown={event => {
                        if (event.key === 'Escape') {
                          cancelEditing();

                          return;
                        }

                        if (event.key === 'Enter') {
                          event.preventDefault();
                          handleSaveEdit(todo);
                        }
                      }}
                    />
                  </div>
                ) : (
                  <>
                    <div
                      data-cy="TodoTitle"
                      className="todo__title"
                      onDoubleClick={() => {
                        setEditingTodoId(todo.id);
                        setEditingValue(todo.title);
                      }}
                    >
                      {todo.title}
                    </div>

                    <button
                      type="button"
                      data-cy="TodoDelete"
                      className="todo__remove"
                      onClick={() => deleteTodo(todo.id)}
                    >
                      ×
                    </button>
                  </>
                )}

                <div
                  className={classNames('overlay', { 'is-active': isLoading })}
                >
                  <div
                    data-cy="TodoLoader"
                    className={classNames('loader', { 'is-active': isLoading })}
                  />
                </div>
              </div>
            );
          })}
        </section>

        {todos.length > 0 && (
          <footer className="todoapp__footer">
            <span data-cy="TodosCounter">{`${activeTodosCount} item${activeTodosCount === 1 ? '' : 's'} left`}</span>

            <div data-cy="Filter" className="filter">
              <button
                type="button"
                data-cy="FilterLinkAll"
                className={classNames('filter__link', {
                  selected: filter === 'all',
                })}
                onClick={() => setFilter('all')}
              >
                All
              </button>
              <button
                type="button"
                data-cy="FilterLinkActive"
                className={classNames('filter__link', {
                  selected: filter === 'active',
                })}
                onClick={() => setFilter('active')}
              >
                Active
              </button>
              <button
                type="button"
                data-cy="FilterLinkCompleted"
                className={classNames('filter__link', {
                  selected: filter === 'completed',
                })}
                onClick={() => setFilter('completed')}
              >
                Completed
              </button>
            </div>

            <button
              type="button"
              data-cy="ClearCompletedButton"
              className="todoapp__clear-completed"
              disabled={!hasCompletedTodos}
              onClick={handleClearCompleted}
            >
              Clear completed
            </button>
          </footer>
        )}
      </div>

      <div
        data-cy="ErrorNotification"
        className={classNames('notification is-danger is-light', {
          hidden: !errorMessage,
        })}
      >
        <button
          type="button"
          data-cy="HideErrorButton"
          className="delete"
          aria-label="Hide error"
          onClick={() => setErrorMessage('')}
        />

        {errorMessage}
      </div>
    </section>
  );
};
