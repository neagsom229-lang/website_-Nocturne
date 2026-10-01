import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Icon } from './Icon';
import { PlaylistItemRow } from './PlaylistItemRow';
import type { PlaylistItem } from '../types';

function SortableItem({
  item,
  onPlay,
  onRemove,
}: {
  item: PlaylistItem;
  onPlay: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  return (
    <div
      ref={setNodeRef}
      className={`playlist-item-sortable${isDragging ? ' is-dragging' : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <PlaylistItemRow
        item={item}
        owner
        onPlay={onPlay}
        onRemove={onRemove}
        dragHandle={(
          <button className="playlist-item__drag" type="button" aria-label={`Reorder ${item.title}`} {...attributes} {...listeners}>
            <Icon name="menu" size={17} />
          </button>
        )}
      />
    </div>
  );
}

export function SortablePlaylistItems({
  items,
  onPlay,
  onRemove,
  onReorder,
}: {
  items: PlaylistItem[];
  onPlay: (item: PlaylistItem) => void;
  onRemove: (item: PlaylistItem) => void;
  onReorder: (orderedIds: number[]) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    if (!event.over || event.active.id === event.over.id) return;
    const oldIndex = items.findIndex((item) => item.id === event.active.id);
    const newIndex = items.findIndex((item) => item.id === event.over?.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(items, oldIndex, newIndex).map((item) => item.id));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
        <div className="playlist-item-list">
          {items.map((item) => (
            <SortableItem
              key={item.id}
              item={item}
              onPlay={() => onPlay(item)}
              onRemove={() => onRemove(item)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
