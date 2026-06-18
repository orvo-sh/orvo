import { toast } from "@repo/components/ui/sonner";

import type {
  FilterBuilderAttribute,
  FilterBuilderFilter,
  FilterBuilderOperator,
  FilterBuilderValueSuggestionsLoader,
} from "./filter-builder.svelte";
import {
  filterBuilderMultiValueDelimiter,
  operatorOptions,
} from "./filter-builder.svelte";

class FilterBuilderState {
  #_valueRequest = 0;
  #_expectsMultiValue = (operator: FilterBuilderOperator | null) =>
    operator === "in" || operator === "not_in";
  #_expectsTypedValue = (
    attribute: FilterBuilderAttribute | null,
    operator: FilterBuilderOperator | null,
  ) =>
    attribute?.type === "number" ||
    attribute?.type === "duration" ||
    operator === "contains" ||
    operator === "not_contains";

  #_addBuilderValue = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }

    if (this.builder.values.includes(trimmed)) {
      this.draft = "";
      return;
    }

    this.builder = {
      ...this.builder,
      values: [...this.builder.values, trimmed],
    };
    this.draft = "";
    this.selectedIndex = 0;
  };

  draft = $state("");
  isPopoverOpen = $state(false);
  selectedIndex = $state(0);

  valueLoading = $state(false);
  valueSuggestions = $state<
    {
      value: string;
      count: number;
    }[]
  >([]);

  inputElement = $state<HTMLInputElement | null>(null);

  builder = $state<{
    attribute: FilterBuilderAttribute | null;
    operator: FilterBuilderOperator | null;
    values: string[];
    stage: "select_attribute" | "select_operator" | "select_value";
  }>({
    attribute: null,
    operator: null,
    values: [],
    stage: "select_attribute",
  });

  suggestions = $derived.by(() => {
    const query = this.draft.trim().toLowerCase();

    switch (this.builder.stage) {
      case "select_attribute":
        const sorted = [...this.attributes].sort((left, right) =>
          left.label.localeCompare(right.label),
        );
        const attribs = !query
          ? sorted
          : sorted.filter((attr) => attr.label.toLowerCase().includes(query));
        return attribs.map((attribute) => ({
          key: attribute.key,
          title: attribute.label,
          kind: "attribute" as const,
        }));
      case "select_operator":
        if (!this.builder.attribute) return [];
        const ops = this.builder.attribute.availableOperators.map(
          (operator) => ({
            operator,
            ...operatorOptions[operator],
          }),
        );
        return ops.map((operator) => ({
          key: operator.operator,
          title: operator.label,
          kind: "operator" as const,
        }));
      case "select_value":
        if (this.#_expectsMultiValue(this.builder.operator)) {
          const pickedValues = new Set(
            this.builder.values.map((value) => value.toLowerCase()),
          );
          const vals = !query
            ? this.valueSuggestions
            : this.valueSuggestions.filter((suggestion) =>
                suggestion.value.toLowerCase().includes(query),
              );

          return vals
            .filter(
              (suggestion) => !pickedValues.has(suggestion.value.toLowerCase()),
            )
            .map((suggestion) => ({
              key: suggestion.value,
              title: suggestion.value,
              kind: "value" as const,
            }));
        }
        if (
          this.#_expectsTypedValue(
            this.builder.attribute,
            this.builder.operator,
          )
        ) {
          return [];
        }
        const vals = !query
          ? this.valueSuggestions
          : this.valueSuggestions.filter((suggestion) =>
              suggestion.value.toLowerCase().includes(query),
            );
        return vals.map((suggestion) => ({
          key: suggestion.value,
          title: suggestion.value,
          kind: "value" as const,
        }));
    }
  });

  expectsTypedValue = $derived.by(
    () =>
      this.builder.stage === "select_value" &&
      this.#_expectsTypedValue(this.builder.attribute, this.builder.operator),
  );

  expectsMultiValue = $derived.by(
    () =>
      this.builder.stage === "select_value" &&
      this.#_expectsMultiValue(this.builder.operator),
  );

  constructor(
    private attributes: FilterBuilderAttribute[],
    private filters: () => FilterBuilderFilter[],
    private onAddFilter: (filter: FilterBuilderFilter) => void,
    private onRemoveFilter: (filter: FilterBuilderFilter) => void,
    private loadValueSuggestions: FilterBuilderValueSuggestionsLoader,
  ) {
    $effect(() => {
      if (
        this.builder.stage !== "select_value" ||
        !this.builder.attribute ||
        !this.builder.operator
      ) {
        this.valueSuggestions = [];
        this.valueLoading = false;
        return;
      }
      if (
        this.#_expectsTypedValue(this.builder.attribute, this.builder.operator)
      ) {
        this.valueSuggestions = [];
        this.valueLoading = false;
        return;
      }
      const requestId = ++this.#_valueRequest;
      const attribute = this.builder.attribute.key;
      const operator = this.builder.operator;
      const query = this.draft.trim();

      this.valueLoading = true;
      const timeout = setTimeout(async () => {
        const result = await this.loadValueSuggestions({
          attribute,
          operator,
          query,
          limit: 10,
        });
        if (requestId !== this.#_valueRequest) return;
        this.valueLoading = false;
        if (result.success === false) {
          toast.error("Failed to load suggested values.", {
            description: result.error,
          });
          this.valueSuggestions = [];
          return;
        }
        this.valueSuggestions = result.data?.values ?? [];
      }, 150);
      return () => clearTimeout(timeout);
    });
  }

  selectAttribute = (attribute: FilterBuilderAttribute) => {
    this.builder = {
      attribute,
      operator: null,
      values: [],
      stage: "select_operator",
    };
    this.draft = "";
    this.selectedIndex = 0;
    this.isPopoverOpen = true;
    this.inputElement?.focus();
  };

  selectOperator = (operator: FilterBuilderOperator) => {
    this.builder = {
      attribute: this.builder.attribute,
      operator,
      values: [],
      stage: "select_value",
    };
    this.draft = "";
    this.selectedIndex = 0;
    this.isPopoverOpen = true;
    this.inputElement?.focus();
  };

  commitFilter = (value: string) => {
    if (!this.builder.attribute || !this.builder.operator || !value.trim())
      return;
    this.onAddFilter({
      attribute: this.builder.attribute.key,
      operator: this.builder.operator,
      value: value.trim(),
    });
    this.builder = {
      attribute: null,
      operator: null,
      values: [],
      stage: "select_attribute",
    };
    this.draft = "";
    this.selectedIndex = 0;
    this.valueSuggestions = [];
    this.valueLoading = false;
    this.inputElement?.focus();
  };

  applySelectedSuggestion = () => {
    const suggestion = this.suggestions[this.selectedIndex];
    if (!suggestion) {
      if (
        this.builder.stage === "select_value" &&
        this.#_expectsMultiValue(this.builder.operator)
      ) {
        if (this.draft.trim()) {
          this.#_addBuilderValue(this.draft);
          return;
        }

        if (this.builder.values.length > 0) {
          this.commitFilter(
            this.builder.values.join(` ${filterBuilderMultiValueDelimiter} `),
          );
        }
        return;
      }

      if (this.builder.stage === "select_value" && this.draft.trim())
        this.commitFilter(this.draft);
      return;
    }
    if (suggestion.kind === "attribute") {
      this.selectAttribute(
        this.attributes.find((value) => value.key === suggestion.key)!,
      );
      return;
    }
    if (suggestion.kind === "operator") {
      this.selectOperator(suggestion.key);
      return;
    }

    if (this.#_expectsMultiValue(this.builder.operator)) {
      this.#_addBuilderValue(suggestion.title);
      return;
    }

    this.commitFilter(suggestion.title);
  };

  resetBuilder = () => {
    this.builder = {
      attribute: null,
      operator: null,
      values: [],
      stage: "select_attribute",
    };

    this.draft = "";
    this.selectedIndex = 0;
    this.valueSuggestions = [];
    this.valueLoading = false;
  };

  moveSelection = (direction: "up" | "down") => {
    const count = this.suggestions.length;
    if (count === 0) return;

    if (direction === "down") {
      this.selectedIndex = (this.selectedIndex + 1) % count;
      return;
    }

    this.selectedIndex =
      this.selectedIndex <= 0 ? count - 1 : this.selectedIndex - 1;
  };

  confirmSelection = () => {
    if (this.builder.stage === "select_attribute") {
      const exactMatch = this.attributes.find(
        (attribute) =>
          attribute.label.toLowerCase() === this.draft.trim().toLowerCase(),
      );

      if (exactMatch) {
        this.selectAttribute(exactMatch);
        return;
      }
    }

    this.applySelectedSuggestion();
  };

  stepBack = () => {
    if (this.builder.stage === "select_value") {
      if (
        this.#_expectsMultiValue(this.builder.operator) &&
        !this.draft &&
        this.builder.values.length > 0
      ) {
        this.builder = {
          ...this.builder,
          values: this.builder.values.slice(0, -1),
        };
        this.selectedIndex = 0;
        return;
      }

      this.builder = {
        ...this.builder,
        operator: null,
        values: [],
        stage: "select_operator",
      };

      this.draft = "";
      this.valueSuggestions = [];
      this.selectedIndex = 0;
      return;
    }

    if (this.builder.stage === "select_operator") {
      this.resetBuilder();
      return;
    }

    const lastFilter = this.filters().at(-1);
    if (lastFilter) {
      this.onRemoveFilter(lastFilter);
    }
  };
}

export default FilterBuilderState;
