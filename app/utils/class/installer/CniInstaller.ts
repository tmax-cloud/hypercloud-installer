/* eslint-disable class-methods-use-this */
/* eslint-disable no-underscore-dangle */
import * as scp from '../../common/scp';
import AbstractInstaller from './AbstractInstaller';
import Env, { NETWORK_TYPE } from '../Env';
import * as common from '../../common/common';
import KubernetesInstaller from './KubernetesInstaller';
import Node from '../Node';
import ScriptFactory from '../script/ScriptFactory';
import CONST from '../../constants/constant';

export default class CniInstaller extends AbstractInstaller {
  public static readonly DIR = `install-cni`;

  public static readonly INSTALL_HOME = `${Env.INSTALL_ROOT}/${CniInstaller.DIR}`;

  public static readonly IMAGE_HOME = `${CniInstaller.INSTALL_HOME}/image`;

  public static readonly CNI_VERSION = `3.16.6`;

  public static readonly CTL_VERSION = `3.16.6`;

  // singleton
  private static instance: CniInstaller;

  private constructor() {
    super();
  }

  static get getInstance() {
    if (!CniInstaller.instance) {
      CniInstaller.instance = new CniInstaller();
    }
    return this.instance;
  }

  /**
   * abstract 메서드 구현부
   */
  public async install(param: {
    type: string;
    version: string;
    callback: any;
    setProgress: Function;
  }) {
    const { version, callback, setProgress } = param;

    setProgress(10);
    await this.preWorkInstall({
      version,
      callback
    });
    setProgress(60);
    await this._installMainMaster(callback);
    setProgress(100);
  }

  public async remove() {
    await this._removeMainMaster();
  }

  protected async preWorkInstall(param: { version: string; callback: any }) {
    console.debug('@@@@@@ Start pre-installation... @@@@@@');
    const { callback } = param;
    // await this._copyFile(callback);
    if (this.env.networkType === NETWORK_TYPE.INTERNAL) {
      // internal network 경우 해주어야 할 작업들
      /**
       * 1. 해당 이미지 파일 다운(client 로컬), 전송 (main 마스터 노드)
       * 2. git guide 다운(client 로컬), 전송(각 노드)
       */
      await this.downloadImageFile();
      await this.sendImageFile();

      await this.downloadGitFile();
      await this.sendGitFile();
    } else if (this.env.networkType === NETWORK_TYPE.EXTERNAL) {
      // external network 경우 해주어야 할 작업들
      /**
       * 1. public 패키지 레포 등록, 설치 (각 노드) (필요 시)
       * 2. git guide clone (마스터 노드)
       */
      await this.cloneGitFile(callback);
    }

    if (this.env.registry) {
      // 내부 image registry 구축 경우 해주어야 할 작업들
      /**
       * 1. 레지스트리 관련 작업
       */
      await this.registryWork({
        callback
      });
    }
    console.debug('###### Finish pre-installation... ######');
  }

  protected async downloadImageFile() {
    // TODO: download image file
    console.debug(
      '@@@@@@ Start downloading the image file to client local... @@@@@@'
    );
    console.debug(
      '###### Finish downloading the image file to client local... ######'
    );
  }

  protected async sendImageFile() {
    console.debug(
      '@@@@@@ Start sending the image file to main master node... @@@@@@'
    );
    const { mainMaster } = this.env.getNodesSortedByRole();
    const srcPath = `${Env.LOCAL_INSTALL_ROOT}/${CniInstaller.DIR}/`;
    await scp.sendFile(mainMaster, srcPath, `${CniInstaller.IMAGE_HOME}/`);
    console.debug(
      '###### Finish sending the image file to main master node... ######'
    );
  }

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
    mainMaster.cmd = script.cloneGitFile(CONST.CNI_REPO, CONST.GIT_BRANCH);
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
    mainMaster.cmd += this._getImagePathEditScript();
    await mainMaster.exeCmd(callback);
    console.debug(
      '###### Finish pushing the image at main master node... ######'
    );
  }

  protected getImagePushScript(): string {
    let gitPullCommand = `
      mkdir -p ~/${CniInstaller.IMAGE_HOME};
      export CNI_HOME=~/${CniInstaller.IMAGE_HOME};
      export CNI_VERSION=v${CniInstaller.CNI_VERSION};
      export CTL_VERSION=v${CniInstaller.CTL_VERSION};
      export REGISTRY=${this.env.registry};
      cd $CNI_HOME;
      `;
    if (this.env.networkType === NETWORK_TYPE.INTERNAL) {
      gitPullCommand += `
        sudo docker load < calico-node_\${CNI_VERSION}.tar;
        sudo docker load < calico-pod2daemon-flexvol_\${CNI_VERSION}.tar;
        sudo docker load < calico-cni_\${CNI_VERSION}.tar;
        sudo docker load < calico-kube-controllers_\${CNI_VERSION}.tar;
        sudo docker load < calico-ctl_\${CTL_VERSION}.tar;
        `;
    } else {
      gitPullCommand += `
        sudo docker pull calico/node:\${CNI_VERSION};
        sudo docker pull calico/pod2daemon-flexvol:\${CNI_VERSION};
        sudo docker pull calico/cni:\${CNI_VERSION};
        sudo docker pull calico/kube-controllers:\${CNI_VERSION};
        sudo docker pull calico/ctl:\${CTL_VERSION};
        # curl https://raw.githubusercontent.com/tmax-cloud/hypercloud-install-guide/master/CNI/calico_v${CniInstaller.CNI_VERSION}.yaml > calico.yaml;
        # curl https://raw.githubusercontent.com/tmax-cloud/hypercloud-install-guide/master/CNI/calicoctl_v${CniInstaller.CTL_VERSION}.yaml > calicoctl.yaml;
        `;
    }
    return `
        ${gitPullCommand}
        sudo docker tag calico/node:\${CNI_VERSION} \${REGISTRY}/calico/node:\${CNI_VERSION};
        sudo docker tag calico/pod2daemon-flexvol:\${CNI_VERSION} \${REGISTRY}/calico/pod2daemon-flexvol:\${CNI_VERSION};
        sudo docker tag calico/cni:\${CNI_VERSION} \${REGISTRY}/calico/cni:\${CNI_VERSION};
        sudo docker tag calico/kube-controllers:\${CNI_VERSION} \${REGISTRY}/calico/kube-controllers:\${CNI_VERSION};
        sudo docker tag calico/ctl:\${CTL_VERSION} \${REGISTRY}/calico/ctl:\${CTL_VERSION};

        sudo docker push \${REGISTRY}/calico/node:\${CNI_VERSION};
        sudo docker push \${REGISTRY}/calico/pod2daemon-flexvol:\${CNI_VERSION};
        sudo docker push \${REGISTRY}/calico/cni:\${CNI_VERSION};
        sudo docker push \${REGISTRY}/calico/kube-controllers:\${CNI_VERSION};
        sudo docker push \${REGISTRY}/calico/ctl:\${CTL_VERSION};
        #rm -rf $CNI_HOME;
        `;
  }

  /**
   * public 메서드
   */
  public static deleteCniConfigScript() {
    return `
      rm -rf /etc/cni/*;
    `;
  }

  /**
   * private 메서드
   */
  private async _installMainMaster(callback: any) {
    console.debug('@@@@@@ Start installing main Master... @@@@@@');
    const { mainMaster } = this.env.getNodesSortedByRole();
    mainMaster.cmd = this._getInstallScript();
    await mainMaster.exeCmd(callback);
    console.debug('###### Finish installing main Master... ######');
  }

  private async _removeMainMaster() {
    console.debug('@@@@@@ Start remove main Master... @@@@@@');
    const { mainMaster } = this.env.getNodesSortedByRole();
    mainMaster.cmd = this._getRemoveScript();
    await mainMaster.exeCmd();
    // FIXME: /etc/cni/ 삭제하면 재설치 시, 노드가 NotReady 상태에서 Ready로 안됨. 원인을 잘 모르겠음
    // await Promise.all(
    //   this.env.nodeList.map((node: Node) => {
    //     node.cmd = CniInstaller.deleteCniConfigScript()
    //     return node.exeCmd();
    //   })
    // );
    console.debug('###### Finish remove main Master... ######');
  }

  private _getInstallScript(): string {
    let script = `
      . ~/${KubernetesInstaller.INSTALL_HOME}/manifest/k8s.config;
      cd ~/${CniInstaller.INSTALL_HOME}/manifest;
      sed -i 's/v3.16.6/'v${CniInstaller.CNI_VERSION}'/g' calico_v${CniInstaller.CNI_VERSION}.yaml;
      sed -i 's|10.0.0.0/16|'$podSubnet'|g' calico_v${CniInstaller.CNI_VERSION}.yaml;
    `;

    // 개발 환경에서는 테스트 시, POD의 메모리를 조정하여 테스트
    if (process.env.RESOURCE === 'low') {
      script += `
        sed -i 's/cpu/#cpu/g' calico_v${CniInstaller.CNI_VERSION}.yaml;
        sed -i 's/memory/#memory/g' calico_v${CniInstaller.CNI_VERSION}.yaml;
      `;
    }

    script += `
      kubectl apply -f calico_v${CniInstaller.CNI_VERSION}.yaml;
      kubectl apply -f calicoctl_v${CniInstaller.CTL_VERSION}.yaml;
    `;
    return script;
  }

  private _getRemoveScript(): string {
    return `
    cd ~/${CniInstaller.INSTALL_HOME}/manifest;
    kubectl delete -f calico_v${CniInstaller.CNI_VERSION}.yaml;
    kubectl delete -f calicoctl_v${CniInstaller.CTL_VERSION}.yaml;
    rm -rf ~/${CniInstaller.INSTALL_HOME};
    `;
  }

  // private async _copyFile(callback: any) {
  //   console.debug('@@@@@@ Start copy yaml file... @@@@@@');
  //   const { mainMaster } = this.env.getNodesSortedByRole();
  //   mainMaster.cmd = `
  //   ${common.getCopyCommandByFilePath(
  //     `~/${CniInstaller.INSTALL_HOME}/calico_v${CniInstaller.CNI_VERSION}.yaml`
  //   )}
  //   ${common.getCopyCommandByFilePath(
  //     `~/${CniInstaller.INSTALL_HOME}/calicoctl_v${CniInstaller.CTL_VERSION}.yaml`
  //   )}
  //   `;
  //   await mainMaster.exeCmd(callback);
  //   console.debug('###### Finish copy yaml file... ######');
  // }

  private _getImagePathEditScript(): string {
    // git guide에 내용 보기 쉽게 변경해놓음 (공백 유지해야함)
    return `
    cd ~/${CniInstaller.INSTALL_HOME}/manifest;
    # sed -i 's/calico\\/cni/'${this.env.registry}'\\/calico\\/cni/g' calico_v${CniInstaller.CNI_VERSION}.yaml;
    # sed -i 's/calico\\/pod2daemon-flexvol/'${this.env.registry}'\\/calico\\/pod2daemon-flexvol/g' calico_v${CniInstaller.CNI_VERSION}.yaml;
    # sed -i 's/calico\\/node/'${this.env.registry}'\\/calico\\/node/g' calico_v${CniInstaller.CNI_VERSION}.yaml;
    # sed -i 's/calico\\/kube-controllers/'${this.env.registry}'\\/calico\\/kube-controllers/g' calico_v${CniInstaller.CNI_VERSION}.yaml;
    # sed -i 's/calico\\/ctl/'${this.env.registry}'\\/calico\\/ctl/g' calicoctl_v${CniInstaller.CTL_VERSION}.yaml;

    sed -i 's| calico/cni| '${this.env.registry}'/calico/cni|g' calico_v${CniInstaller.CNI_VERSION}.yaml;
    sed -i 's| calico/pod2daemon-flexvol| '${this.env.registry}'/calico/pod2daemon-flexvol|g' calico_v${CniInstaller.CNI_VERSION}.yaml;
    sed -i 's| calico/node| '${this.env.registry}'/calico/node|g' calico_v${CniInstaller.CNI_VERSION}.yaml;
    sed -i 's| calico/kube-controllers| '${this.env.registry}'/calico/kube-controllers|g' calico_v${CniInstaller.CNI_VERSION}.yaml;
    sed -i 's| calico/ctl| '${this.env.registry}'/calico/ctl|g' calicoctl_v${CniInstaller.CTL_VERSION}.yaml;
    `;
  }
}
