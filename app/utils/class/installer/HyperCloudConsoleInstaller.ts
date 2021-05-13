/* eslint-disable class-methods-use-this */
/* eslint-disable no-underscore-dangle */
import * as scp from '../../common/scp';
import AbstractInstaller from './AbstractInstaller';
import Env, { NETWORK_TYPE } from '../Env';
import ScriptFactory from '../script/ScriptFactory';
import CONST from '../../constants/constant';

export default class HyperCloudConsoleInstaller extends AbstractInstaller {
  public static readonly IMAGE_DIR = `install-console`;

  public static readonly INSTALL_HOME = `${Env.INSTALL_ROOT}/${HyperCloudConsoleInstaller.IMAGE_DIR}`;

  public static readonly IMAGE_HOME = `${HyperCloudConsoleInstaller.INSTALL_HOME}/image`;

  public static readonly CONSOLE_VERSION = `5.1.2.1`;

  public static readonly OPERATOR_VERSION = `5.1.0.1`;

  public static readonly CONSOLE_NAMESPACE = `console-system`;

  // public static readonly HCDC_MODE = false;

  // singleton
  private static instance: HyperCloudConsoleInstaller;

  private constructor() {
    super();
  }

  static get getInstance() {
    if (!HyperCloudConsoleInstaller.instance) {
      HyperCloudConsoleInstaller.instance = new HyperCloudConsoleInstaller();
    }
    return this.instance;
  }

  /**
   * abstract 메서드 구현부
   */
  public async install(param: { callback: any; setProgress: Function }) {
    const { callback } = param;

    await this.preWorkInstall({
      callback
    });

    await this._installMainMaster(callback);
  }

  public async remove() {
    await this._removeMainMaster();
  }

  // protected abstract 구현
  protected async preWorkInstall(param?: any) {
    console.debug('@@@@@@ Start pre-installation... @@@@@@');
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
      // TODO: downloadYamlAtLocal();
      // TODO: sendYaml();
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
    console.debug('###### Finish pre-installation... ######');
  }

  // protected async downloadImageFile() {
  //   // TODO: download image file
  //   console.debug(
  //     '@@@@@@ Start downloading the image file to client local... @@@@@@'
  //   );
  //   console.debug(
  //     '###### Finish downloading the image file to client local... ######'
  //   );
  // }

  // protected async sendImageFile() {
  //   console.debug(
  //     '@@@@@@ Start sending the image file to main master node... @@@@@@'
  //   );
  //   const { mainMaster } = this.env.getNodesSortedByRole();
  //   const srcPath = `${Env.LOCAL_INSTALL_ROOT}/${HyperCloudConsoleInstaller.IMAGE_DIR}/`;
  //   await scp.sendFile(
  //     mainMaster,
  //     srcPath,
  //     `${HyperCloudConsoleInstaller.IMAGE_HOME}/`
  //   );
  //   console.debug(
  //     '###### Finish sending the image file to main master node... ######'
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
    mainMaster.cmd = script.cloneGitFile(CONST.CONSOLE_REPO, CONST.GIT_BRANCH);
    await mainMaster.exeCmd(callback);
    console.debug('###### Finish clone the GIT file at each node... ######');
  }

  protected async registryWork(param: { callback: any }) {
    console.debug(
      '@@@@@@ Start pushing the image at main master node... @@@@@@'
    );
    const { callback } = param;
    const { mainMaster } = this.env.getNodesSortedByRole();
    mainMaster.cmd = this.getImagePushScript();
    await mainMaster.exeCmd(callback);
    console.debug(
      '###### Finish pushing the image at main master node... ######'
    );
  }

  // protected getImagePushScript(): string {
  //   let gitPullCommand = `
  // mkdir -p ~/${HyperCloudConsoleInstaller.IMAGE_HOME};
  // export CONSOLE_HOME=~/${HyperCloudConsoleInstaller.IMAGE_HOME};
  // export CONSOLE_VERSION=v${HyperCloudConsoleInstaller.CONSOLE_VERSION};
  // export REGISTRY=${this.env.registry};
  // cd $CONSOLE_HOME;
  // `;
  //   if (this.env.networkType === NETWORK_TYPE.INTERNAL) {
  //     gitPullCommand += `
  //   sudo docker load < console_\${CONSOLE_VERSION}.tar;
  //   `;
  //   } else {
  //     gitPullCommand += `
  //   sudo docker pull  tmaxcloudck/hypercloud-console:\${CONSOLE_VERSION};
  //   `;
  //   }
  //   return `
  //   ${gitPullCommand}
  //   sudo docker tag tmaxcloudck/hypercloud-console:\${CONSOLE_VERSION} \${REGISTRY}/tmaxcloudck/hypercloud-console:\${CONSOLE_VERSION};

  //   sudo docker push \${REGISTRY}/tmaxcloudck/hypercloud-console:\${CONSOLE_VERSION}
  //   #rm -rf $CONSOLE_HOME;
  //   `;
  // }

  private async _installMainMaster(callback: any) {
    console.debug('@@@@@@ Start installing console main Master... @@@@@@');
    const { mainMaster } = this.env.getNodesSortedByRole();

    // FIXME: 추후 - --managed-gitlab-url=@@GITLAB@@ 주석처리하는 sed 부분 제거 해야함
    // export CLIENTID=hypercloud4 변경 해야함 hypercloud5로
    mainMaster.cmd = `
    cd ~/${HyperCloudConsoleInstaller.INSTALL_HOME};

    sed -i 's/- --managed-gitlab-url=@@GITLAB@@//g' deployments/5.deploy.yaml;

    export OPERATOR_VER=${HyperCloudConsoleInstaller.OPERATOR_VERSION}
    export CONSOLE_VER=${HyperCloudConsoleInstaller.CONSOLE_VERSION}
    export KIALI=0.0.0.0:20001
    export KIBANA=0.0.0.0:80
    export REALM=tmax
    export KEYCLOAK=\`kubectl describe service hyperauth -n hyperauth | grep 'LoadBalancer Ingress' | cut -d ' ' -f7\`;
    export CLIENTID=hypercloud4
    export MC_MODE=false

    chmod +x install.sh
    ./install.sh
    `;
    await mainMaster.exeCmd(callback);

    console.debug('###### Finish installing console main Master... ######');
  }

  private async _removeMainMaster() {
    console.debug('@@@@@@ Start remove console main Master... @@@@@@');
    const { mainMaster } = this.env.getNodesSortedByRole();
    mainMaster.cmd = this._getRemoveScript();
    await mainMaster.exeCmd();
    console.debug('###### Finish remove console main Master... ######');
  }

  private _getRemoveScript(): string {
    return `
    cd ~/${HyperCloudConsoleInstaller.INSTALL_HOME};
    kubectl delete -f ./deployments
    # kubectl delete -f 3.deployment.yaml;
    # kubectl delete -f 2.svc-lb.yaml;
    # kubectl delete secret console-https-secret -n ${HyperCloudConsoleInstaller.CONSOLE_NAMESPACE};
    # kubectl delete -f 1.initialization.yaml;
    # kubectl delete -f ./manifest
    rm -rf ~/${HyperCloudConsoleInstaller.INSTALL_HOME};
    `;
  }
}
