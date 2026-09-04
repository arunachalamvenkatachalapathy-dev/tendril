import EntryComposer from './EntryComposer.jsx';

export default function VoiceComposer({ onSaved, onSurfacedIdeas }) {
  return (
    <EntryComposer
      onSaved={onSaved}
      onExtractIdeas={onSurfacedIdeas}
      initialVoiceActive={true}
    />
  );
}
