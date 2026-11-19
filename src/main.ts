import './styles.css';
import type { Activity } from './model/types';
import { saveActivity } from './persistence/storage';
import { renderStartScreen } from './ui/startScreen';
import { renderMappingPhase } from './ui/mappingPhase';
import { renderMapView } from './ui/mapView';
import { renderCodePanel } from './ui/codePanel';

const app = document.getElementById('app')!;

type AppView = 'start' | 'mapping' | 'map' | 'code';

let view: AppView = 'start';
let activity: Activity | null = null;

function handleUpdate(a: Activity): void {
  activity = a;
  saveActivity(a);
}

function navigate(newView: AppView, newActivity?: Activity): void {
  if (newActivity) activity = newActivity;
  if (activity) saveActivity(activity);
  view = newView;
  renderApp();
}

function renderApp(): void {
  app.innerHTML = '';
  switch (view) {
    case 'start':
      renderStartScreen(app, {
        onOpen: a => navigate('mapping', a),
        onNew:  a => navigate('mapping', a),
        onImport: a => navigate('mapping', a),
      });
      break;
    case 'mapping':
      renderMappingPhase(
        app,
        activity!,
        handleUpdate,
        a => navigate('map', a),
      );
      break;
    case 'map':
      renderMapView(
        app,
        activity!,
        handleUpdate,
        () => navigate('mapping'),
        a => navigate('code', a),
      );
      break;
    case 'code':
      renderCodePanel(
        app,
        activity!,
        handleUpdate,
        () => navigate('map'),
      );
      break;
  }
}

renderApp();
