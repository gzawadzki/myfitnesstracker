import React, { useMemo, useRef, useState, useEffect } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';

const shortenExerciseName = (name = '') => {
  const words = name.trim().split(/\s+/);
  if (words.length <= 2) return name;
  return `${words[0]} ${words[1]}`;
};

export default function ExercisePicker({
  exercises = [],
  selectedExerciseId,
  onSelect,
  placeholder = 'Select exercise',
  title = 'Pick exercise'
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const wrapperRef = useRef(null);
  const searchInputRef = useRef(null);

  const selectedExercise = useMemo(
    () => exercises.find((exercise) => exercise.id === selectedExerciseId),
    [exercises, selectedExerciseId]
  );

  const filteredExercises = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return exercises;

    return exercises.filter((exercise) => {
      const fullName = exercise.name?.toLowerCase() || '';
      const shortName = shortenExerciseName(exercise.name).toLowerCase();
      return fullName.includes(normalizedQuery) || shortName.includes(normalizedQuery);
    });
  }, [exercises, query]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleOutsideClick = (event) => {
      if (!wrapperRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [isOpen]);

  const handlePick = (exerciseId) => {
    onSelect(exerciseId);
    setIsOpen(false);
    setQuery('');
  };

  const onSearchKeyDown = (event) => {
    if (event.key === 'Escape') {
      setIsOpen(false);
      return;
    }

    if (!filteredExercises.length) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((prev) => (prev + 1) % filteredExercises.length);
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((prev) => (prev - 1 + filteredExercises.length) % filteredExercises.length);
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      handlePick(filteredExercises[activeIndex]?.id);
    }
  };

  const selectedShortName = shortenExerciseName(selectedExercise?.name || '');

  return (
    <div className="relative flex-1" ref={wrapperRef}>
      <button
        type="button"
        className="w-full rounded-md text-left"
        style={{
          padding: '10px 12px',
          background: 'var(--surface-color)',
          border: '1px solid var(--surface-border)',
          minHeight: '44px'
        }}
        onClick={() => {
          setActiveIndex(0);
          setIsOpen((prev) => !prev);
        }}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            {selectedExercise ? (
              <>
                <div className="text-sm font-medium truncate" title={selectedExercise.name}>{selectedShortName}</div>
                {selectedShortName !== selectedExercise.name && (
                  <div className="text-xs text-muted truncate" title={selectedExercise.name}>{selectedExercise.name}</div>
                )}
              </>
            ) : (
              <span className="text-sm text-muted">{placeholder}</span>
            )}
          </div>
          <ChevronDown size={16} className="text-muted" />
        </div>
      </button>

      {isOpen && (
        <div
          className="card glass animate-fade-in"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: 0,
            right: 0,
            zIndex: 30,
            padding: 'var(--space-3)',
            maxHeight: '320px',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}
          role="dialog"
          aria-label={title}
        >
          <div className="flex items-center gap-2 mb-2 px-2 py-2 rounded" style={{ background: 'var(--surface-color)', border: '1px solid var(--surface-border)' }}>
            <Search size={16} className="text-muted" />
            <input
              ref={searchInputRef}
              type="text"
              className="w-full"
              placeholder="Search exercises..."
              style={{ background: 'transparent', border: 'none', outline: 'none' }}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={onSearchKeyDown}
              autoFocus
            />
            {(query || selectedExerciseId) && (
              <button
                type="button"
                className="btn-icon text-muted"
                style={{ padding: '2px' }}
                onClick={() => {
                  if (query) {
                    setQuery('');
                    searchInputRef.current?.focus();
                  } else {
                    onSelect(null);
                    setIsOpen(false);
                  }
                }}
                aria-label={query ? 'Clear search' : 'Clear selected exercise'}
              >
                <X size={16} />
              </button>
            )}
          </div>

          <div style={{ overflow: 'auto' }}>
            {filteredExercises.map((exercise, index) => {
              const shortName = shortenExerciseName(exercise.name);
              const isActive = index === activeIndex;
              const isSelected = exercise.id === selectedExerciseId;

              return (
                <button
                  key={exercise.id}
                  type="button"
                  className="w-full text-left rounded mb-1"
                  style={{
                    padding: '10px 12px',
                    minHeight: '44px',
                    border: `1px solid ${isActive ? 'var(--accent-primary)' : 'var(--surface-border)'}`,
                    background: isSelected ? 'rgba(79, 70, 229, 0.14)' : 'var(--surface-color)'
                  }}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => handlePick(exercise.id)}
                >
                  <div className="text-sm font-medium" title={exercise.name}>{shortName}</div>
                  {shortName !== exercise.name && (
                    <div className="text-xs text-muted" title={exercise.name}>{exercise.name}</div>
                  )}
                </button>
              );
            })}

            {!filteredExercises.length && (
              <p className="text-xs text-muted py-3 text-center">No exercises found for "{query}".</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
