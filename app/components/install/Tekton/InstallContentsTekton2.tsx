import React, { useState, useContext } from 'react';
import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  IconButton
} from '@material-ui/core';
// import { KubeInstallContext } from './InstallContentsKubernetes';
import CloseIcon from '@material-ui/icons/Close';
import CONST from '../../../utils/constants/constant';
import routes from '../../../utils/constants/routes.json';
import styles from '../InstallContents2.css';
import * as env from '../../../utils/common/env';
import { AppContext } from '../../../containers/AppContext';

function InstallContentsTekton2(props: any) {
  console.debug(InstallContentsTekton2.name, props);
  const { history, match, state } = props;

  const appContext = useContext(AppContext);
  const { appState, dispatchAppState } = appContext;

  const nowEnv = env.loadEnvByName(match.params.envName);

  const [open, setOpen] = React.useState(false);
  const handleClickOpen = () => {
    setOpen(true);
  };
  const handleClose = () => {
    setOpen(false);
  };

  return (
    <div className={[styles.wrap].join(' ')}>
      <div className={['childLeftRightLeft'].join(' ')}>
        <div className={[styles.titleBox].join(' ')}>
          <span className={['medium'].join(' ')}>Pipeline Version</span>
        </div>
        <div>
          <span className={['medium', 'lightDark'].join(' ')}>
            {state.pipeline_version}
          </span>
        </div>
      </div>
      <div className={['childLeftRightLeft'].join(' ')}>
        <div className={[styles.titleBox].join(' ')}>
          <span className={['medium'].join(' ')}>Trigger Version</span>
        </div>
        <div>
          <span className={['medium', 'lightDark'].join(' ')}>
            {state.trigger_version}
          </span>
        </div>
      </div>
      {/* <div className={['childLeftRightLeft'].join(' ')}>
        <div className={[styles.titleBox].join(' ')}>
          <span className={['medium'].join(' ')}>Approval Version</span>
        </div>
        <div>
          <span className={['medium', 'lightDark'].join(' ')}>
            {state.approval_version}
          </span>
        </div>
      </div>
      <div className={['childLeftRightLeft'].join(' ')}>
        <div className={[styles.titleBox].join(' ')}>
          <span className={['medium'].join(' ')}>Mail-notifier Version</span>
        </div>
        <div>
          <span className={['medium', 'lightDark'].join(' ')}>
            {state.mailNotifier_version}
          </span>
        </div>
      </div> */}
      <div className={['childLeftRightLeft'].join(' ')}>
        <div className={[styles.titleBox].join(' ')}>
          <span className={['medium'].join(' ')}>CI/CD Templates Version</span>
        </div>
        <div>
          <span className={['medium', 'lightDark'].join(' ')}>
            {state.cicdTemplates_version}
          </span>
        </div>
      </div>
      <div
        style={{ marginTop: '50px' }}
        className={['childLeftRightCenter'].join(' ')}
      >
        <Button
          variant="contained"
          style={{ marginRight: '10px' }}
          className={['primary'].join(' ')}
          size="large"
          onClick={() => {
            dispatchAppState({
              type: 'set_installing',
              installing: CONST.PRODUCT.TEKTON.NAME
            });
            history.push(
              `${routes.INSTALL.HOME}/${nowEnv.name}/${CONST.PRODUCT.TEKTON.NAME}/step3`
            );
          }}
        >
          설치
        </Button>
        <Button
          variant="contained"
          className={['secondary'].join(' ')}
          size="large"
          onClick={() => {
            handleClickOpen();
          }}
        >
          취소
        </Button>
        <Dialog
          open={open}
          onClose={handleClose}
          aria-labelledby="alert-dialog-title"
          aria-describedby="alert-dialog-description"
        >
          <DialogTitle id="alert-dialog-title">
            나가기
            <IconButton
              style={{
                position: 'absolute',
                right: '5px',
                top: '5px'
              }}
              aria-label="close"
              onClick={handleClose}
            >
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent>
            <DialogContentText id="alert-dialog-description">
              <span className={['lightDark', 'small'].join(' ')}>
                {CONST.PRODUCT.TEKTON.NAME} 설정 화면에서 나가시겠습니까? 설정
                내용은 저장되지 않습니다.
              </span>
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button
              className={['primary'].join(' ')}
              size="small"
              onClick={() => {
                handleClose();
                history.push(
                  `${routes.INSTALL.HOME}/${nowEnv.name}/${CONST.PRODUCT.TEKTON.NAME}/step1`
                );
              }}
            >
              나가기
            </Button>
            <Button
              className={['secondary'].join(' ')}
              onClick={handleClose}
              color="primary"
              size="small"
              autoFocus
            >
              취소
            </Button>
          </DialogActions>
        </Dialog>
      </div>
    </div>
  );
}

export default InstallContentsTekton2;
