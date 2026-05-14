'use client';

import * as React from 'react';
import { Button, type ButtonProps } from './button';
import { Input } from './input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './modal';

interface ConfirmDialogOptions {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: ButtonProps['variant'];
}

interface TextPromptDialogOptions {
  title: string;
  label: string;
  description?: string;
  defaultValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  validate?: (value: string) => string | null;
}

type TextPromptVisualOptions = Omit<TextPromptDialogOptions, 'validate'>;

export function useConfirmDialog() {
  const [request, setRequest] = React.useState<ConfirmDialogOptions | null>(null);
  const resolverRef = React.useRef<((confirmed: boolean) => void) | null>(null);

  const confirmAction = React.useCallback((options: ConfirmDialogOptions) => {
    resolverRef.current?.(false);

    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setRequest(options);
    });
  }, []);

  const resolveConfirmation = React.useCallback((confirmed: boolean) => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    setRequest(null);
    resolve?.(confirmed);
  }, []);

  React.useEffect(() => {
    return () => {
      resolverRef.current?.(false);
      resolverRef.current = null;
    };
  }, []);

  const confirmDialog = (
    <Dialog
      open={Boolean(request)}
      onOpenChange={(open) => {
        if (!open) resolveConfirmation(false);
      }}
    >
      <DialogContent showClose={false}>
        <DialogHeader>
          <DialogTitle>{request?.title}</DialogTitle>
          <DialogDescription>{request?.description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:space-x-0">
          <Button type="button" variant="outline" onClick={() => resolveConfirmation(false)}>
            {request?.cancelLabel || 'Cancel'}
          </Button>
          <Button
            type="button"
            variant={request?.confirmVariant || 'default'}
            onClick={() => resolveConfirmation(true)}
          >
            {request?.confirmLabel || 'Continue'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { confirmAction, confirmDialog };
}

export function useTextPromptDialog() {
  const inputId = React.useId();
  const [request, setRequest] = React.useState<TextPromptVisualOptions | null>(null);
  const [value, setValue] = React.useState('');
  const [error, setError] = React.useState('');
  const resolverRef = React.useRef<((value: string | null) => void) | null>(null);
  const validatorRef = React.useRef<TextPromptDialogOptions['validate'] | null>(null);

  const promptForText = React.useCallback((options: TextPromptDialogOptions) => {
    resolverRef.current?.(null);

    return new Promise<string | null>((resolve) => {
      resolverRef.current = resolve;
      validatorRef.current = options.validate || null;
      setValue(options.defaultValue || '');
      setError('');
      setRequest({
        title: options.title,
        label: options.label,
        description: options.description,
        defaultValue: options.defaultValue,
        placeholder: options.placeholder,
        confirmLabel: options.confirmLabel,
        cancelLabel: options.cancelLabel,
      });
    });
  }, []);

  const closePrompt = React.useCallback(() => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    validatorRef.current = null;
    setRequest(null);
    setValue('');
    setError('');
    resolve?.(null);
  }, []);

  const submitPrompt = React.useCallback(() => {
    const trimmedValue = value.trim();
    const validationError = validatorRef.current?.(trimmedValue) || null;

    if (validationError) {
      setError(validationError);
      return;
    }

    const resolve = resolverRef.current;
    resolverRef.current = null;
    validatorRef.current = null;
    setRequest(null);
    setValue('');
    setError('');
    resolve?.(trimmedValue);
  }, [value]);

  React.useEffect(() => {
    return () => {
      resolverRef.current?.(null);
      resolverRef.current = null;
      validatorRef.current = null;
    };
  }, []);

  const textPromptDialog = (
    <Dialog
      open={Boolean(request)}
      onOpenChange={(open) => {
        if (!open) closePrompt();
      }}
    >
      <DialogContent showClose={false}>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            submitPrompt();
          }}
        >
          <DialogHeader>
            <DialogTitle>{request?.title}</DialogTitle>
            {request?.description && (
              <DialogDescription>{request.description}</DialogDescription>
            )}
          </DialogHeader>
          <div className="space-y-2">
            <label htmlFor={inputId} className="text-sm font-semibold text-gray-700">
              {request?.label}
            </label>
            <Input
              id={inputId}
              value={value}
              onChange={(event) => {
                setValue(event.target.value);
                setError('');
              }}
              placeholder={request?.placeholder}
              error={Boolean(error)}
              autoFocus
            />
            {error && (
              <p role="alert" className="text-xs font-medium text-red-600">
                {error}
              </p>
            )}
          </div>
          <DialogFooter className="gap-2 sm:space-x-0">
            <Button type="button" variant="outline" onClick={closePrompt}>
              {request?.cancelLabel || 'Cancel'}
            </Button>
            <Button type="submit">{request?.confirmLabel || 'Save'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );

  return { promptForText, textPromptDialog };
}
