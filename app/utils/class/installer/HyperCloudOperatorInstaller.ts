/* eslint-disable class-methods-use-this */
/* eslint-disable no-underscore-dangle */
import * as scp from '../../common/scp';
import AbstractInstaller from './AbstractInstaller';
import Env, { NETWORK_TYPE } from '../Env';
import SecretWatcherInstaller from './SecretWatcherInstaller';
import IngressControllerInstaller from './IngressControllerInstaller';
import ScriptFactory from '../script/ScriptFactory';
import CONST from '../../constants/constant';

export default class HyperCloudOperatorInstaller extends AbstractInstaller {
  public static readonly DIR = `install-hypercloud`;

  public static readonly INSTALL_HOME = `${Env.INSTALL_ROOT}/${HyperCloudOperatorInstaller.DIR}`;

  public static readonly IMAGE_HOME = `${HyperCloudOperatorInstaller.INSTALL_HOME}/image`;

  public static readonly HPCD_MODE = `single`;

  public static readonly HPCD_SINGLE_OPERATOR_VERSION = `5.0.3.0`;

  public static readonly HPCD_MULTI_OPERATOR_VERSION = `5.0.3.0`;

  public static readonly HPCD_API_SERVER_VERSION = `5.0.3.0`;

  public static readonly HPCD_POSTGRES_VERSION = `5.0.0.1`;

  public static readonly INVITATION_TOKEN_EXPIRED_DATE = `7days`;

  // FIXME: 4.1에서 사용되던 버전. 삭제 되어야 함
  public static readonly HPCD_VERSION = `4.1.9.2`;

  // singleton
  private static instance: HyperCloudOperatorInstaller;

  private constructor() {
    super();
  }

  static get getInstance() {
    if (!HyperCloudOperatorInstaller.instance) {
      HyperCloudOperatorInstaller.instance = new HyperCloudOperatorInstaller();
    }
    return this.instance;
  }

  /**
   * abstract 메서드 구현부
   */
  public async install(param: {
    state: any;
    callback: any;
    setProgress: Function;
  }) {
    const { state, callback, setProgress } = param;

    await this.preWorkInstall({
      callback
    });

    // ingress 설치
    if (state.isUseIngress) {
      const ingressControllerInstaller = IngressControllerInstaller.getInstance;
      ingressControllerInstaller.env = this.env;
      await ingressControllerInstaller.install({
        callback,
        setProgress,
        shared: state.sharedIngress,
        systemd: state.systemIngress
      });
    }

    // operator 설치
    await this._installMainMaster(state, callback);
  }

  public async remove() {
    // operator 삭제
    await this._removeMainMaster();

    // ingress controller 삭제
    // 현재 shared, system 둘 다 삭제함
    const ingressControllerInstaller = IngressControllerInstaller.getInstance;
    ingressControllerInstaller.env = this.env;
    await ingressControllerInstaller.remove();
  }

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
  //   const srcPath = `${Env.LOCAL_INSTALL_ROOT}/${HyperCloudOperatorInstaller.DIR}/`;
  //   await scp.sendFile(
  //     mainMaster,
  //     srcPath,
  //     `${HyperCloudOperatorInstaller.IMAGE_HOME}/`
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
    mainMaster.cmd = script.cloneGitFile(
      CONST.HYPERCLOUD_REPO,
      CONST.GIT_BRANCH
    );
    await mainMaster.exeCmd(callback);
    console.debug('###### Finish clone the GIT file at each node... ######');
  }

  // protected async registryWork(param: { callback: any }) {
  //   console.debug(
  //     '@@@@@@ Start pushing the image at main master node... @@@@@@'
  //   );
  //   const { callback } = param;
  //   const { mainMaster } = this.env.getNodesSortedByRole();
  //   mainMaster.cmd = this.getImagePushScript();
  //   await mainMaster.exeCmd(callback);
  //   console.debug(
  //     '###### Finish pushing the image at main master node... ######'
  //   );
  // }

  // protected getImagePushScript(): string {
  //   let gitPullCommand = `
  // mkdir -p ~/${HyperCloudOperatorInstaller.IMAGE_HOME};
  // export HPCD_HOME=~/${HyperCloudOperatorInstaller.IMAGE_HOME};
  // export HPCD_VERSION=${HyperCloudOperatorInstaller.HPCD_VERSION};
  // export REGISTRY=${this.env.registry};
  // cd $HPCD_HOME;
  // `;
  //   if (this.env.networkType === NETWORK_TYPE.INTERNAL) {
  //     gitPullCommand += `
  //   sudo docker load < mysql_5.6.tar;
  //   sudo docker load < registry_2.6.2.tar;
  //   sudo docker load < hypercloud-operator_b\${HPCD_VERSION}.tar;
  //   `;
  //   } else {
  //     gitPullCommand += `
  //   sudo docker pull mysql:5.6;
  //   sudo docker pull registry:2.6.2;
  //   sudo docker pull tmaxcloudck/hypercloud-operator:b\${HPCD_VERSION};
  //   `;
  //   }
  //   return `
  //   ${gitPullCommand}
  //   sudo docker tag mysql:5.6 \${REGISTRY}/mysql:5.6
  //   sudo docker tag registry:2.6.2 \${REGISTRY}/registry:2.6.2
  //   sudo docker tag tmaxcloudck/hypercloud-operator:b\${HPCD_VERSION} \${REGISTRY}/tmaxcloudck/hypercloud-operator:b\${HPCD_VERSION}

  //   sudo docker push \${REGISTRY}/mysql:5.6
  //   sudo docker push \${REGISTRY}/registry:2.6.2
  //   sudo docker push \${REGISTRY}/tmaxcloudck/hypercloud-operator:b\${HPCD_VERSION}
  //   #rm -rf $HPCD_HOME;
  //   `;
  // }

  /**
   * private 메서드
   */
  private async _installMainMaster(state: any, callback: any) {
    console.debug(
      '@@@@@@ Start installing hypercloud operator main Master... @@@@@@'
    );
    const { mainMaster } = this.env.getNodesSortedByRole();

    // Step 0. hypercloud.config 설정
    mainMaster.cmd = this._step0();
    await mainMaster.exeCmd(callback);

    // Step 1. installer 실행
    mainMaster.cmd = this._step1();
    await mainMaster.exeCmd(callback);

    console.debug(
      '###### Finish installing hypercloud operator main Master... ######'
    );
  }

  private _step0() {
    const { mainMaster, masterArr } = this.env.getNodesSortedByRole();

    // 마스터 다중화 경우
    // mainMaster 제외한 나머지 마스터 노드들
    // 계정정보 넣어주기 위한 문자열 조합
    const MASTER_NODE_ROOT_USER = `("${masterArr
      .map(master => {
        return master.user;
      })
      .join(' ')}")`;

    const MASTER_NODE_ROOT_PASSWORD = `("${masterArr
      .map(master => {
        return master.password;
      })
      .join(' ')}")`;

    let script = `
      cd ~/${HyperCloudOperatorInstaller.INSTALL_HOME};
      sudo sed -i 's|\\r$||g' hypercloud.config;
      . hypercloud.config;

      sudo sed -i "s|$HPCD_MODE|${HyperCloudOperatorInstaller.HPCD_MODE}|g" ./hypercloud.config;
      sudo sed -i "s|$HPCD_SINGLE_OPERATOR_VERSION|${HyperCloudOperatorInstaller.HPCD_SINGLE_OPERATOR_VERSION}|g" ./hypercloud.config;
      sudo sed -i "s|$HPCD_MULTI_OPERATOR_VERSION|${HyperCloudOperatorInstaller.HPCD_MULTI_OPERATOR_VERSION}|g" ./hypercloud.config;
      sudo sed -i "s|$HPCD_API_SERVER_VERSION|${HyperCloudOperatorInstaller.HPCD_API_SERVER_VERSION}|g" ./hypercloud.config;
      sudo sed -i "s|$HPCD_POSTGRES_VERSION|${HyperCloudOperatorInstaller.HPCD_POSTGRES_VERSION}|g" ./hypercloud.config;
      sudo sed -i "s|$MAIN_MASTER_IP|${mainMaster.ip}|g" ./hypercloud.config;
      sudo sed -i "s|$MASTER_NODE_ROOT_USER|${MASTER_NODE_ROOT_USER}|g" ./hypercloud.config;
      sudo sed -i "s|$MASTER_NODE_ROOT_PASSWORD|${MASTER_NODE_ROOT_PASSWORD}|g" ./hypercloud.config;
      sudo sed -i "s|$INVITATION_TOKEN_EXPIRED_DATE|${HyperCloudOperatorInstaller.INVITATION_TOKEN_EXPIRED_DATE}|g" ./hypercloud.config;
    `;

    if (this.env.registry) {
      script += `sudo sed -i "s|$REGISTRY|${this.env.registry}|g" ./hypercloud.config;`;
    }

    return script;
  }

  private _step1() {
    return `
    cd ~/${HyperCloudOperatorInstaller.INSTALL_HOME};
    sudo chmod +x install.sh;
    ./install.sh
    `;
  }

  private async _removeMainMaster() {
    console.debug(
      '@@@@@@ Start remove hypercloud operator main Master... @@@@@@'
    );
    const { mainMaster } = this.env.getNodesSortedByRole();
    mainMaster.cmd = this._getRemoveScript();
    await mainMaster.exeCmd();
    console.debug(
      '###### Finish remove hypercloud operator main Master... ######'
    );
  }

  private _getRemoveScript(): string {
    return `
    cd ~/${HyperCloudOperatorInstaller.INSTALL_HOME};
    sudo chmod +x uninstall.sh;
    ./uninstall.sh;
    rm -rf ~/${HyperCloudOperatorInstaller.INSTALL_HOME};
    `;
  }
}
