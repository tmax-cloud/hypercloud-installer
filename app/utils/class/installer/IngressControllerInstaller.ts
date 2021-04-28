/* eslint-disable class-methods-use-this */
/* eslint-disable no-underscore-dangle */
import * as scp from '../../common/scp';
import AbstractInstaller from './AbstractInstaller';
import Env, { NETWORK_TYPE } from '../Env';
import CONST from '../../constants/constant';
import ScriptFactory from '../script/ScriptFactory';

export default class IngressControllerInstaller extends AbstractInstaller {
  public static readonly DIR = `install-ingress`;

  public static readonly INSTALL_HOME = `${Env.INSTALL_ROOT}/${IngressControllerInstaller.DIR}`;

  public static readonly IMAGE_HOME = `${IngressControllerInstaller.INSTALL_HOME}/image`;

  public static readonly INGRESS_NGINX_NAME = `ingress-nginx-shared`;

  public static readonly INGRESS_CLASS = `nginx-shd`;

  public static readonly NGINX_INGRESS_VERSION = `0.33.0`;

  public static readonly KUBE_WEBHOOK_CERTGEN_VERSION = `1.2.2`;

  // singleton
  private static instance: IngressControllerInstaller;

  private constructor() {
    super();
  }

  static get getInstance() {
    if (!IngressControllerInstaller.instance) {
      IngressControllerInstaller.instance = new IngressControllerInstaller();
    }
    return this.instance;
  }

  public async install(param: {
    callback: any;
    setProgress: Function;
    shared: boolean;
    systemd: boolean;
  }) {
    const { callback, shared, systemd } = param;

    await this.preWorkInstall({
      callback
    });
    await this._installMainMaster(callback, shared, systemd);
  }

  public async remove() {
    await this._removeMainMaster();
  }

  // protected abstract 구현
  protected async preWorkInstall(param: { callback: any }) {
    console.debug('@@@@@@ START pre-installation... @@@@@@');
    const { callback } = param;
    if (this.env.networkType === NETWORK_TYPE.INTERNAL) {
      // internal network 경우 해주어야 할 작업들
      /**
       * 1. 해당 이미지 파일 다운(client 로컬), 전송 (main 마스터 노드)
       * 2. git guide 다운(client 로컬), 전송(각 노드)
       */
      // await this.downloadImageFile();
      // await this.sendImageFile();

      await this.downloadGitFile();
      await this.sendGitFile();
    } else if (this.env.networkType === NETWORK_TYPE.EXTERNAL) {
      // external network 경우 해주어야 할 작업들
      /**
       * 1. public 패키지 레포 등록, 설치 (각 노드) (필요 시)
       * 2. git guide clone (마스터 노드)
       */
      await this.cloneGitFile(callback);
      // await this._downloadYaml();
    }

    if (this.env.registry) {
      // 내부 image registry 구축 경우 해주어야 할 작업들
      /**
       * 1. 레지스트리 관련 작업
       */
      // await this.registryWork({
      //   callback
      // });
    }
    console.debug('###### FINISH pre-installation... ######');
  }

  // protected async downloadImageFile() {
  //   // TODO: download image file
  //   console.debug(
  //     '@@@@@@ START downloading the image file to client local... @@@@@@'
  //   );
  //   console.debug(
  //     '###### FINISH downloading the image file to client local... ######'
  //   );
  // }

  // protected async sendImageFile() {
  //   console.debug(
  //     '@@@@@@ START sending the image file to main master node... @@@@@@'
  //   );
  //   const { mainMaster } = this.env.getNodesSortedByRole();
  //   const srcPath = `${Env.LOCAL_INSTALL_ROOT}/${IngressControllerInstaller.DIR}/`;
  //   await scp.sendFile(
  //     mainMaster,
  //     srcPath,
  //     `${IngressControllerInstaller.IMAGE_HOME}/`
  //   );
  //   console.debug(
  //     '###### FINISH sending the image file to main master node... ######'
  //   );
  // }

  protected downloadGitFile(param?: any): Promise<any> {
    throw new Error('Method not implemented.');
  }

  protected sendGitFile(param?: any): Promise<any> {
    throw new Error('Method not implemented.');
  }

  protected async cloneGitFile(callback: any) {
    console.debug('@@@@@@ Start clone the GIT file at each node... @@@@@@');
    const { mainMaster } = this.env.getNodesSortedByRole();
    const script = ScriptFactory.createScript(mainMaster.os.type);
    mainMaster.cmd = script.cloneGitFile(CONST.INGRESS_REPO, CONST.GIT_BRANCH);
    await mainMaster.exeCmd(callback);
    console.debug('###### Finish clone the GIT file at each node... ######');
  }

  // protected async registryWork(param: { callback: any }) {
  //   console.debug(
  //     '@@@@@@ START pushing the image at main master node... @@@@@@'
  //   );
  //   const { callback } = param;
  //   const { mainMaster } = this.env.getNodesSortedByRole();
  //   mainMaster.cmd = this.getImagePushScript();
  //   await mainMaster.exeCmd(callback);
  //   console.debug(
  //     '###### FINISH pushing the image at main master node... ######'
  //   );
  // }

  // protected getImagePushScript(): string {
  //   let gitPullCommand = `
  //   mkdir -p ~/${IngressControllerInstaller.IMAGE_HOME};
  //   ${this._exportEnv()}
  //   cd $NGINX_INGRESS_HOME;
  //   `;
  //   if (this.env.networkType === NETWORK_TYPE.INTERNAL) {
  //     gitPullCommand += `
  //     sudo docker load < ingress-nginx_\${NGINX_INGRESS_VERSION}.tar;
  //     sudo docker load < kube-webhook-certgen_\${KUBE_WEBHOOK_CERTGEN_VERSION}.tar;
  //     `;
  //   } else {
  //     gitPullCommand += `
  //     sudo docker pull quay.io/kubernetes-ingress-controller/nginx-ingress-controller:\${NGINX_INGRESS_VERSION};
  //     sudo docker pull jettech/kube-webhook-certgen:\${KUBE_WEBHOOK_CERTGEN_VERSION};

  //     #sudo docker save quay.io/kubernetes-ingress-controller/nginx-ingress-controller:\${NGINX_INGRESS_VERSION} > ingress-nginx_\${NGINX_INGRESS_VERSION}.tar
  //     #sudo docker save jettech/kube-webhook-certgen:\${KUBE_WEBHOOK_CERTGEN_VERSION} > kube-webhook-certgen_\${KUBE_WEBHOOK_CERTGEN_VERSION}.tar
  //     `;
  //   }
  //   return `
  //     ${gitPullCommand}
  //     sudo docker tag quay.io/kubernetes-ingress-controller/nginx-ingress-controller:\${NGINX_INGRESS_VERSION} \${REGISTRY}/kubernetes-ingress-controller/nginx-ingress-controller:\${NGINX_INGRESS_VERSION};
  //     sudo docker tag jettech/kube-webhook-certgen:\${KUBE_WEBHOOK_CERTGEN_VERSION} \${REGISTRY}/jettech/kube-webhook-certgen:\${KUBE_WEBHOOK_CERTGEN_VERSION};

  //     sudo docker push \${REGISTRY}/kubernetes-ingress-controller/nginx-ingress-controller:\${NGINX_INGRESS_VERSION}
  //     sudo docker push \${REGISTRY}/jettech/kube-webhook-certgen:\${KUBE_WEBHOOK_CERTGEN_VERSION}
  //     #rm -rf $NGINX_INGRESS_HOME;
  //     `;
  // }

  // private _exportEnv() {
  //   return `
  //   export NGINX_INGRESS_HOME=~/${IngressControllerInstaller.IMAGE_HOME};
  //   export INGRESS_NGINX_NAME=${IngressControllerInstaller.INGRESS_NGINX_NAME};
  //   export INGRESS_CLASS=${IngressControllerInstaller.INGRESS_CLASS};
  //   export NGINX_INGRESS_VERSION=${IngressControllerInstaller.NGINX_INGRESS_VERSION};
  //   export KUBE_WEBHOOK_CERTGEN_VERSION=v${IngressControllerInstaller.KUBE_WEBHOOK_CERTGEN_VERSION};
  //   export REGISTRY=${this.env.registry};
  //   `;
  // }

  private async _installMainMaster(
    callback: any,
    shared: boolean,
    systemd: boolean
  ) {
    console.debug(
      '@@@@@@ START installing nginx ingress controller main Master... @@@@@@'
    );
    const { mainMaster } = this.env.getNodesSortedByRole();

    // Step 0. ingress.config 수정
    mainMaster.cmd = this._step0();
    await mainMaster.exeCmd(callback);

    // Step 1. nginx ingress controller 설치
    if (shared) {
      mainMaster.cmd = this._shared();
      await mainMaster.exeCmd(callback);
    }
    if (systemd) {
      mainMaster.cmd = this._systemd();
      await mainMaster.exeCmd(callback);
    }

    console.debug(
      '###### FINISH installing nginx ingress controller main Master... ######'
    );
  }

  private _step0() {
    let script = `
      cd ~/${IngressControllerInstaller.INSTALL_HOME}/manifest;
      sudo sed -i 's|\\r$||g' ingress.config;
      . ingress.config;

      sudo sed -i "s|$NGINX_INGRESS_VERSION|${IngressControllerInstaller.NGINX_INGRESS_VERSION}|g" ./ingress.config;
      sudo sed -i "s|$KUBE_WEBHOOK_CERTGEN_VERSION|v${IngressControllerInstaller.KUBE_WEBHOOK_CERTGEN_VERSION}|g" ./ingress.config;
    `;

    if (this.env.registry) {
      script += `sudo sed -i "s|$NGINX_INGRESS_CONTROLLER_IMAGE|${this.env.registry}/$NGINX_INGRESS_CONTROLLER_IMAGE|g" ./ingress.config;`;
      script += `sudo sed -i "s|$KUBE_WEBHOOK_CERTGEN_IMAGE|${this.env.registry}/$NGINX_INGRESS_CONTROLLER_IMAGE|g" ./ingress.config;`;
    }

    return script;
  }

  private _shared() {
    return `
    cd ~/${IngressControllerInstaller.INSTALL_HOME}/manifest/;
    sudo chmod +x install-ingress.sh;
    ./install-ingress.sh install_shared
    `;
  }

  private _systemd() {
    return `
    cd ~/${IngressControllerInstaller.INSTALL_HOME}/manifest/;
    sudo chmod +x install-ingress.sh;
    ./install-ingress.sh install_system
    `;
  }

  private async _removeMainMaster() {
    console.debug(
      '@@@@@@ START remove nginx ingress controller main Master... @@@@@@'
    );
    const { mainMaster } = this.env.getNodesSortedByRole();
    mainMaster.cmd = this._getRemoveScript();
    await mainMaster.exeCmd();
    console.debug(
      '###### FINISH remove nginx ingress controller main Master... ######'
    );
  }

  private _getRemoveScript(): string {
    return `
    cd ~/${IngressControllerInstaller.INSTALL_HOME}/manifest/;
    ./install-ingress.sh uninstall_system
    ./install-ingress.sh uninstall_shared
    rm -rf ~/${IngressControllerInstaller.INSTALL_HOME};

    `;
  }
}
