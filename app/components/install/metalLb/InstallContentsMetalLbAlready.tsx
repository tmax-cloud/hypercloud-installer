import React, { useContext } from 'react';
import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  IconButton
} from '@material-ui/core';
import MuiBox from '@material-ui/core/Box';
import CloseIcon from '@material-ui/icons/Close';
import styles from '../InstallContents1.css';
import { AppContext } from '../../../containers/AppContext';
import CONST from '../../../utils/constants/constant';
import productImage from '../../../../resources/assets/MetalLb_logo.png';
import FinishImage from '../../../../resources/assets/img_finish_mint.svg';
import * as env from '../../../utils/common/env';
import routes from '../../../utils/constants/routes.json';
import MetalLbInstaller from '../../../utils/class/installer/MetalLbInstaller';

function InstallContentsMetalLbAlready(props: any) {
  console.debug(InstallContentsMetalLbAlready.name, props);
  const { history, match } = props;

  const appContext = useContext(AppContext);
  const { dispatchAppState } = appContext;

  const nowEnv = env.loadEnvByName(match.params.envName);
  const nowProduct = CONST.PRODUCT.METAL_LB;
  const product = nowEnv.isInstalled(nowProduct.NAME);

  const [open, setOpen] = React.useState(false);
  const handleClickOpen = () => {
    setOpen(true);
  };
  const handleClose = () => {
    setOpen(false);
  };

  const defaultProps = {
    bgcolor: 'background.paper',
    borderColor: 'text.primary',
    m: 1,
    border: 1,
    style: { width: '20rem', height: '20rem' }
  };

  const remove = async () => {
    // 삭제는 설치의 역순
    console.debug(`nowEnv`, nowEnv);

    const metalLbInstaller = MetalLbInstaller.getInstance;
    metalLbInstaller.env = nowEnv;

    await metalLbInstaller.remove();
  };

  return (
    <div className={[styles.wrap, 'childLeftRightCenter'].join(' ')}>
      <div>
        <div className={styles.contents}>
          <div className="childLeftRightCenter">
            <MuiBox
              className={[
                'childUpDownCenter',
                'childLeftRightCenter',
                styles.installedCircle
              ].join(' ')}
              borderRadius="50%"
              {...defaultProps}
            >
              <img
                className={[styles.installedImage].join(' ')}
                src={FinishImage}
                alt="Logo"
              />
              <div className={[styles.insideCircle].join(' ')}>
                <div>
                  <img src={productImage} alt="Logo" />
                </div>
                <div>
                  <span className={['large', 'thick'].join(' ')}>
                    {nowProduct.NAME}
                  </span>
                </div>
                <div>
                  <span className={['small', 'lightDark'].join(' ')}>
                    {nowProduct.DESC}
                  </span>
                </div>
              </div>
            </MuiBox>
          </div>
          <div />
          <div>
            <div>
              <span className={['medium', 'thick'].join(' ')}>Version</span>
            </div>
            <div>
              <span className={['medium', 'lightDark'].join(' ')}>
                {product.version}
              </span>
            </div>
          </div>
          <div>
            <div>
              <span className={['medium', 'thick'].join(' ')}>IP Range</span>
            </div>
            <div>
              <span className={['lightDark'].join(' ')}>
                {product.range.map((r: string) => {
                  return (
                    <div key={r}>
                      <span>{r}</span>
                    </div>
                  );
                })}
              </span>
            </div>
          </div>
          <div>
            <span
              style={{ marginRight: '5px' }}
              className={['small', 'lightDark'].join(' ')}
            >
              더 이상 사용하지 않는다면?
            </span>
            <span className={['small', 'indicator'].join(' ')}>
              <a
                onClick={() => {
                  handleClickOpen();
                }}
              >
                삭제
              </a>
            </span>
          </div>
        </div>
        <div>
          <div>
            <Dialog
              open={open}
              onClose={handleClose}
              aria-labelledby="alert-dialog-title"
              aria-describedby="alert-dialog-description"
            >
              <DialogTitle id="alert-dialog-title">
                삭제
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
                    {CONST.PRODUCT.METAL_LB.NAME} 를 삭제하시겠습니까?
                  </span>
                </DialogContentText>
              </DialogContent>
              <DialogActions>
                <Button
                  className={['primary'].join(' ')}
                  onClick={async () => {
                    try {
                      dispatchAppState({
                        type: 'set_loading',
                        loading: true
                      });
                      handleClose();
                      await remove();
                      nowEnv.deleteProductByName(nowProduct.NAME);
                      env.updateEnv(nowEnv.name, nowEnv);
                      history.push(
                        `${routes.INSTALL.HOME}/${nowEnv.name}/main`
                      );
                    } catch (error) {
                      console.error(error);
                    } finally {
                      dispatchAppState({
                        type: 'set_loading',
                        loading: false
                      });
                    }
                  }}
                >
                  삭제
                </Button>
                <Button
                  className={['secondary'].join(' ')}
                  onClick={handleClose}
                  autoFocus
                >
                  취소
                </Button>
              </DialogActions>
            </Dialog>
          </div>
        </div>
      </div>
    </div>
  );
}

export default InstallContentsMetalLbAlready;
