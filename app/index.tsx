import React, { Fragment } from 'react';
import { render } from 'react-dom';
import { AppContainer as ReactHotAppContainer } from 'react-hot-loader';
import { Color, Titlebar } from 'custom-electron-titlebar';
import Root from './containers/Root';
import { configureStore, history } from './store/configureStore';
import './app.global.css';
import MasterImage from '../resources/assets/logo_installer.svg';

const store = configureStore();

const AppContainer = process.env.PLAIN_HMR ? Fragment : ReactHotAppContainer;

document.addEventListener('DOMContentLoaded', () => {
  // eslint-disable-next-line no-new
  new Titlebar({
    backgroundColor: Color.fromHex('#000'),
    icon: MasterImage,
    menu: null
  });
  render(
    <AppContainer>
      <Root store={store} history={history} />
    </AppContainer>,
    document.getElementById('root')
  );
});
